import "server-only";
import QRCode from "qrcode";
import { isEmailConfigured, sendEmail } from "./email";
import { receiptEmail, ticketsEmail, type OrderForEmail } from "./email-templates";
import { issueTickets } from "./issue-tickets";
import { supabase } from "./supabase";
import type { PaymentMethod } from "./ticket-types";

export function siteUrl() {
  return (process.env.SITE_URL || "https://brickcityevent.site").replace(/\/$/, "");
}

export const ticketUrl = (code: string) => `${siteUrl()}/t/${code}`;

type SaleRow = {
  id: string;
  tier_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  unit_price_naira: number;
  total_naira: number;
  payment_method: PaymentMethod;
  checkout_id: string | null;
  status: string;
  paid_at: string | null;
  created_at: string;
  receipt_sent_at: string | null;
  tickets_sent_at: string | null;
  ticket_tiers: { name: string; description: string | null } | null;
};

/**
 * For a paid order: issues its tickets, then sends the receipt and the tickets email, each at most once.
 * Each email is "claimed" by stamping its sent time before sending, so two webhook deliveries arriving
 * together can't both send it; a failed send releases the claim so a retry (or "Resend emails") works.
 * `force` re-sends emails that already went out (for the admin "Resend emails" button).
 */
export async function fulfilSale(saleId: string, { force = false } = {}) {
  const db = supabase();
  const { data: sale, error } = await db
    .from("ticket_sales")
    .select(
      "id, tier_id, buyer_name, buyer_email, quantity, unit_price_naira, total_naira, payment_method, checkout_id, status, paid_at, created_at, receipt_sent_at, tickets_sent_at, ticket_tiers(name, description)",
    )
    .eq("id", saleId)
    .single<SaleRow>();
  if (error || !sale) throw new Error(`Order ${saleId} not found: ${error?.message}`);
  if (sale.status !== "paid") return { skipped: `order is ${sale.status}` };

  const tickets = await issueTickets(sale.id, sale.tier_id, sale.quantity);
  if (!isEmailConfigured()) return { skipped: "email not configured", tickets: tickets.length };

  const order: OrderForEmail = {
    id: sale.id,
    buyerName: sale.buyer_name,
    buyerEmail: sale.buyer_email,
    tierName: sale.ticket_tiers?.name ?? "Ticket",
    tierDescription: sale.ticket_tiers?.description ?? null,
    quantity: sale.quantity,
    unitPriceNaira: sale.unit_price_naira,
    totalNaira: sale.total_naira,
    paymentMethod: sale.payment_method,
    checkoutId: sale.checkout_id,
    paidAt: sale.paid_at ?? sale.created_at,
  };
  const stamp = force ? `-${Date.now()}` : "";
  const sent: string[] = [];

  async function once(column: "receipt_sent_at" | "tickets_sent_at", send: () => Promise<unknown>) {
    let claim = db.from("ticket_sales").update({ [column]: new Date().toISOString() }).eq("id", sale!.id);
    if (!force) claim = claim.is(column, null);
    const { data: claimed, error: claimError } = await claim.select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed?.length) return; // already sent
    try {
      await send();
      sent.push(column);
    } catch (e) {
      await db.from("ticket_sales").update({ [column]: null, email_error: (e as Error).message }).eq("id", sale!.id);
      throw e;
    }
  }

  await once("receipt_sent_at", () => {
    const r = receiptEmail(order);
    return sendEmail({ to: order.buyerEmail, ...r, idempotencyKey: `receipt-${order.id}${stamp}` });
  });

  await once("tickets_sent_at", async () => {
    const live = tickets.filter((t) => !t.void);
    const withQr = await Promise.all(
      live.map(async (t) => ({
        code: t.code,
        holderNumber: t.holderNumber,
        qrCid: `qr-${t.code}`,
        url: ticketUrl(t.code),
        png: await QRCode.toBuffer(t.code, { type: "png", width: 420, margin: 2, errorCorrectionLevel: "M" }),
      })),
    );
    const m = ticketsEmail(order, withQr);
    return sendEmail({
      to: order.buyerEmail,
      ...m,
      idempotencyKey: `tickets-${order.id}${stamp}`,
      attachments: withQr.map((t) => ({
        filename: `${t.code}.png`,
        content: t.png.toString("base64"),
        content_type: "image/png",
        content_id: t.qrCid,
      })),
    });
  });

  await db.from("ticket_sales").update({ email_error: null }).eq("id", sale.id);
  return { sent, tickets: tickets.length };
}
