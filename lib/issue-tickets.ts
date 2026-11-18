import "server-only";
import { randomInt } from "node:crypto";
import { supabase } from "./supabase";

// No 0/O, 1/I/L or 5/S: codes get read aloud and typed at the door.
const ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789";
const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const newTicketCode = () => `NN-${block()}-${block()}`;

export type IssuedTicket = { code: string; holderNumber: number; void: boolean; checkedInAt: string | null };

/** Makes sure a paid order has one ticket per person, creating any that are missing. Safe to repeat. */
export async function issueTickets(saleId: string, tierId: string, quantity: number): Promise<IssuedTicket[]> {
  const db = supabase();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing, error } = await db
      .from("tickets")
      .select("code, holder_number, void, checked_in_at")
      .eq("sale_id", saleId)
      .order("holder_number");
    if (error) throw new Error(`Could not load tickets: ${error.message}`);
    const have = new Set(existing.map((t) => t.holder_number));
    const missing = Array.from({ length: quantity }, (_, i) => i + 1).filter((n) => !have.has(n));
    if (missing.length === 0) {
      return existing.map((t) => ({ code: t.code, holderNumber: t.holder_number, void: t.void, checkedInAt: t.checked_in_at }));
    }
    // ignoreDuplicates: a parallel call that already created holder N wins; a clashing code just retries.
    const { error: insertError } = await db
      .from("tickets")
      .upsert(
        missing.map((n) => ({ sale_id: saleId, tier_id: tierId, holder_number: n, code: newTicketCode() })),
        { onConflict: "sale_id,holder_number", ignoreDuplicates: true },
      );
    if (insertError && insertError.code !== "23505") throw new Error(`Could not issue tickets: ${insertError.message}`);
  }
  throw new Error("Could not issue tickets after several attempts");
}
