import "server-only";
import { connection } from "next/server";
import { supabase } from "./supabase";
import { lagosDay, type PaymentMethod, type Sale, type SaleInput, type TicketTier } from "./ticket-types";
import { getAllTiers } from "./tickets";

type SaleRow = {
  id: string;
  tier_id: string;
  buyer_name: string;
  buyer_email: string;
  quantity: number;
  unit_price_naira: number;
  total_naira: number;
  payment_method: PaymentMethod;
  note: string | null;
  status: Sale["status"];
  source: Sale["source"];
  oversold: boolean;
  hold_expires_at: string | null;
  created_at: string;
  tickets_sent_at: string | null;
  email_error: string | null;
  ticket_tiers: { name: string } | null;
};

const fromRow = (r: SaleRow): Sale => ({
  id: r.id,
  tierId: r.tier_id,
  tierName: r.ticket_tiers?.name ?? "Deleted tier",
  buyerName: r.buyer_name,
  buyerEmail: r.buyer_email,
  quantity: r.quantity,
  unitPriceNaira: r.unit_price_naira,
  totalNaira: r.total_naira,
  paymentMethod: r.payment_method,
  note: r.note,
  status: r.status,
  source: r.source,
  oversold: r.oversold,
  createdAt: new Date(r.created_at).toISOString(),
  emailed: Boolean(r.tickets_sent_at),
  emailError: r.email_error,
});

/** Records a sale; the database refuses it if the tier doesn't have enough tickets left. */
export async function recordSale(input: SaleInput): Promise<string> {
  const { data, error } = await supabase().rpc("record_ticket_sale", {
    p_tier_id: input.tierId,
    p_buyer_name: input.buyerName,
    p_buyer_email: input.buyerEmail,
    p_quantity: input.quantity,
    p_payment_method: input.paymentMethod,
    p_note: input.note,
  });
  if (error) {
    // P0001/P0002 are our own friendly messages from record_ticket_sale.
    throw new Error(error.code === "P0001" || error.code === "P0002" ? error.message : `Couldn't record the sale: ${error.message}`);
  }
  return (data as { id: string }).id;
}

/** Marks a sale refunded, which puts its tickets back on sale. */
export async function refundSale(id: string) {
  const { error } = await supabase()
    .from("ticket_sales")
    .update({ status: "refunded", refunded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "paid");
  if (error) throw new Error(error.message);
  // Refunded tickets stop working at the door.
  const { error: voidError } = await supabase().from("tickets").update({ void: true }).eq("sale_id", id);
  if (voidError) throw new Error(voidError.message);
}

export type TierStats = TicketTier & { sold: number; held: number; remaining: number; revenue: number };
export type DayPoint = { day: string; tickets: number; revenue: number };

export type Dashboard = {
  tiers: TierStats[];
  sales: Sale[];
  totals: {
    revenue: number;
    sold: number;
    held: number;
    capacity: number;
    remaining: number;
    orders: number;
    refunds: number;
    online: number;
    oversold: number;
  };
  byMethod: { method: PaymentMethod; revenue: number; orders: number }[];
  daily: DayPoint[];
  loadedAt: number;
};

/** Everything the admin dashboard shows. Admin only; never cached. */
export async function getDashboard(): Promise<Dashboard> {
  await connection();
  const [{ tiers, loadedAt }, salesResult] = await Promise.all([
    getAllTiers(),
    supabase()
      .from("ticket_sales")
      .select(
        "id, tier_id, buyer_name, buyer_email, quantity, unit_price_naira, total_naira, payment_method, note, status, source, oversold, hold_expires_at, created_at, tickets_sent_at, email_error, ticket_tiers(name)",
      )
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);
  if (salesResult.error) throw new Error(`Could not load sales: ${salesResult.error.message}`);
  const rows = salesResult.data as unknown as SaleRow[];
  const sales = rows.map(fromRow);
  const paid = sales.filter((s) => s.status === "paid");
  // Online orders still inside their payment window hold tickets too.
  const holding = rows.filter((r) => r.status === "pending" && r.hold_expires_at && Date.parse(r.hold_expires_at) > loadedAt);

  const tierStats: TierStats[] = tiers.map((t) => {
    const mine = paid.filter((s) => s.tierId === t.id);
    const sold = mine.reduce((n, s) => n + s.quantity, 0);
    const held = holding.filter((r) => r.tier_id === t.id).reduce((n, r) => n + r.quantity, 0);
    return { ...t, sold, held, remaining: Math.max(t.quantity - sold - held, 0), revenue: mine.reduce((n, s) => n + s.totalNaira, 0) };
  });

  const byMethod = new Map<PaymentMethod, { revenue: number; orders: number }>();
  for (const s of paid) {
    const m = byMethod.get(s.paymentMethod) ?? { revenue: 0, orders: 0 };
    m.revenue += s.totalNaira;
    m.orders += 1;
    byMethod.set(s.paymentMethod, m);
  }

  // One point per Lagos calendar day, from the first sale (at most 30 days back) to today, gaps filled with zero.
  const perDay = new Map<string, DayPoint>();
  for (const s of paid) {
    const day = lagosDay(s.createdAt);
    const p = perDay.get(day) ?? { day, tickets: 0, revenue: 0 };
    p.tickets += s.quantity;
    p.revenue += s.totalNaira;
    perDay.set(day, p);
  }
  const daily: DayPoint[] = [];
  if (paid.length) {
    const today = lagosDay(loadedAt);
    const first = [...perDay.keys()].sort()[0];
    const start = Math.max(Date.parse(`${first}T00:00:00Z`), Date.parse(`${today}T00:00:00Z`) - 29 * 86400_000);
    for (let t = start; t <= Date.parse(`${today}T00:00:00Z`); t += 86400_000) {
      const day = new Date(t).toISOString().slice(0, 10);
      daily.push(perDay.get(day) ?? { day, tickets: 0, revenue: 0 });
    }
  }

  const capacity = tierStats.reduce((n, t) => n + t.quantity, 0);
  const sold = tierStats.reduce((n, t) => n + t.sold, 0);
  const held = tierStats.reduce((n, t) => n + t.held, 0);
  return {
    tiers: tierStats,
    sales,
    totals: {
      revenue: paid.reduce((n, s) => n + s.totalNaira, 0),
      sold,
      held,
      capacity,
      remaining: Math.max(capacity - sold - held, 0),
      orders: paid.length,
      refunds: sales.filter((s) => s.status === "refunded").length,
      online: paid.filter((s) => s.source === "online").length,
      oversold: paid.filter((s) => s.oversold).length,
    },
    byMethod: [...byMethod.entries()].map(([method, m]) => ({ method, ...m })).sort((a, b) => b.revenue - a.revenue),
    daily,
    loadedAt,
  };
}
