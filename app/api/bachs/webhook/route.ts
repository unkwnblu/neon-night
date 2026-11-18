import { revalidateTag } from "next/cache";
import { fulfilSale } from "@/lib/fulfil";
import { isBachsConfigured, verifyWebhook, type BachsEvent } from "@/lib/bachs";
import { supabase } from "@/lib/supabase";
import { TIERS_TAG } from "@/lib/tickets";

// Bachs posts payment events here. Register this URL in the Bachs developer portal:
//   https://<your-domain>/api/bachs/webhook
// Events used: checkout.completed, collection.succeeded, checkout.expired.

export async function POST(request: Request) {
  if (!isBachsConfigured()) return new Response("Payments not configured", { status: 503 });

  const raw = await request.text();
  let event: BachsEvent;
  try {
    // The docs name the header X-Bachs-Signature-V2; the dashboard calls it Bachs-Signature. Accept either.
    const signature =
      request.headers.get("x-bachs-signature-v2") ??
      request.headers.get("bachs-signature") ??
      request.headers.get("x-bachs-signature");
    event = verifyWebhook(raw, signature, Math.floor(Date.now() / 1000), request.headers.get("x-bachs-timestamp"));
  } catch (e) {
    // 4xx tells Bachs not to retry a delivery we'll never accept.
    return new Response((e as Error).message, { status: 400 });
  }

  const db = supabase();
  const { data: seen } = await db.from("payment_webhook_events").select("id").eq("id", event.id).maybeSingle();
  if (seen) return Response.json({ ok: true, duplicate: true });

  try {
    await handle(event);
  } catch (e) {
    console.error(`Bachs webhook ${event.type} ${event.id} failed:`, e);
    // 5xx makes Bachs retry later; handling is idempotent so a retry is safe.
    return new Response("Processing failed", { status: 500 });
  }

  await db.from("payment_webhook_events").insert({ id: event.id, type: event.type });
  return Response.json({ ok: true });
}

async function handle(event: BachsEvent) {
  const { checkout_id: checkoutId, reference } = event.data;
  const db = supabase();

  switch (event.type) {
    case "checkout.completed":
      if (event.data.payment_status && !["paid", "no_payment_required"].includes(event.data.payment_status)) return;
    // falls through: both events mean the money is in.
    case "collection.succeeded": {
      if (!checkoutId) return;
      // The checkout id is stored right after the session is created; if a payment somehow
      // lands first, link it through our reference (the sale id).
      if (reference) {
        await db.from("ticket_sales").update({ checkout_id: checkoutId }).eq("id", reference).is("checkout_id", null);
      }
      const { data: sale, error } = await db
        .rpc("mark_online_sale_paid", { p_checkout_id: checkoutId })
        .maybeSingle<{ id: string | null; status: string | null }>();
      if (error) throw new Error(error.message);
      revalidateTag(TIERS_TAG, "max");
      // Tickets + receipt and tickets emails. Done before replying so a failure makes Bachs retry;
      // anything already sent is skipped on the retry.
      if (sale?.id && sale.status === "paid") await fulfilSale(sale.id);
      return;
    }
    case "checkout.expired": {
      if (!checkoutId) return;
      // A late bank transfer can still complete it afterwards; mark_online_sale_paid accepts expired orders.
      const { error } = await db
        .from("ticket_sales")
        .update({ status: "expired" })
        .eq("checkout_id", checkoutId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      revalidateTag(TIERS_TAG, "max");
      return;
    }
    default:
      return;
  }
}
