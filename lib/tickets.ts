import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { PublicTier, TicketTier, TierInput } from "./ticket-types";

export const TIERS_TAG = "ticket-tiers";

type Row = {
  id: string;
  name: string;
  description: string | null;
  price_naira: number;
  quantity: number;
  sales_start: string;
  sales_end: string | null;
  sort_order: number;
  is_hidden: boolean;
};

const COLUMNS = "id, name, description, price_naira, quantity, sales_start, sales_end, sort_order, is_hidden";

const fromRow = (r: Row): TicketTier => ({
  id: r.id,
  name: r.name,
  description: r.description,
  priceNaira: r.price_naira,
  quantity: r.quantity,
  salesStart: new Date(r.sales_start).toISOString(),
  salesEnd: r.sales_end ? new Date(r.sales_end).toISOString() : null,
  sortOrder: r.sort_order,
  hidden: r.is_hidden,
});

const toRow = (t: TierInput) => ({
  name: t.name,
  description: t.description,
  price_naira: t.priceNaira,
  quantity: t.quantity,
  sales_start: t.salesStart,
  sales_end: t.salesEnd,
  sort_order: t.sortOrder,
  is_hidden: t.hidden,
  updated_at: new Date().toISOString(),
});

/** Every tier, hidden ones included, plus when they were read. Admin only; never cached. */
export async function getAllTiers(): Promise<{ tiers: TicketTier[]; loadedAt: number }> {
  await connection();
  const { data, error } = await supabase()
    .from("ticket_tiers")
    .select(COLUMNS)
    .order("sort_order")
    .order("sales_start");
  if (error) throw new Error(`Could not load ticket tiers: ${error.message}`);
  return { tiers: (data as Row[]).map(fromRow), loadedAt: Date.now() };
}

/**
 * Visible tiers for the public page. Cached and refreshed the moment an admin
 * saves a change (see updateTag in app/admin/actions.ts), or within minutes otherwise.
 */
export async function getPublicTiers(): Promise<PublicTier[]> {
  "use cache";
  cacheTag(TIERS_TAG);
  cacheLife("minutes");
  if (!isSupabaseConfigured()) return [];
  const { data, error } = await supabase()
    .from("ticket_tiers")
    .select(COLUMNS)
    .eq("is_hidden", false)
    .order("sort_order")
    .order("sales_start");
  if (error) {
    console.error("Could not load ticket tiers for the public page:", error.message);
    return [];
  }
  // How many are left (not who bought them) is all the public page learns about sales.
  // Counts paid tickets plus live checkout holds, worked out in the database.
  const { data: taken, error: takenError } = await supabase().rpc("tier_availability");
  if (takenError) console.error("Could not load ticket availability for the public page:", takenError.message);
  const sold = new Map<string, number>(((taken ?? []) as { tier_id: string; taken: number }[]).map((r) => [r.tier_id, r.taken]));

  return (data as Row[]).map((r) => {
    const t = fromRow(r);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      priceNaira: t.priceNaira,
      quantity: t.quantity,
      salesStart: t.salesStart,
      salesEnd: t.salesEnd,
      remaining: Math.max(t.quantity - (sold.get(t.id) ?? 0), 0),
    };
  });
}

export async function createTier(input: TierInput) {
  const { error } = await supabase().from("ticket_tiers").insert(toRow(input));
  if (error) throw new Error(error.message);
}

export async function updateTier(id: string, input: TierInput) {
  const { error } = await supabase().from("ticket_tiers").update(toRow(input)).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTier(id: string) {
  const { error } = await supabase().from("ticket_tiers").delete().eq("id", id);
  // 23503: sales still point at this tier.
  if (error?.code === "23503") throw new Error("This tier has sales recorded, so it can't be deleted. Hide it instead.");
  if (error) throw new Error(error.message);
}
