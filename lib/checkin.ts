import "server-only";
import { supabase } from "./supabase";

export type ScanResult =
  | { kind: "not_found"; code: string }
  | {
      kind: "valid" | "checked_in" | "void";
      code: string;
      holderName: string;
      email: string;
      tierName: string;
      perk: string | null;
      holderNumber: number;
      ofQuantity: number;
      checkedInAt: string | null;
    };

const CODE = /^NN-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Accepts what a camera or a person produces: the bare code, a /t/<code> link, odd spacing or case. */
export function normaliseCode(raw: string) {
  const s = raw.trim().toUpperCase();
  const fromUrl = s.match(/NN-[A-Z0-9]{4}-[A-Z0-9]{4}/)?.[0];
  if (fromUrl) return fromUrl;
  const bare = s.replace(/[^A-Z0-9]/g, "").replace(/^NN/, "");
  return bare.length === 8 ? `NN-${bare.slice(0, 4)}-${bare.slice(4)}` : s;
}

type Row = {
  code: string;
  holder_number: number;
  void: boolean;
  checked_in_at: string | null;
  ticket_tiers: { name: string; description: string | null } | null;
  ticket_sales: { buyer_name: string; buyer_email: string; quantity: number; status: string } | null;
};

export async function lookupTicket(raw: string): Promise<ScanResult> {
  const code = normaliseCode(raw);
  if (!CODE.test(code)) return { kind: "not_found", code };
  const { data: t, error } = await supabase()
    .from("tickets")
    .select("code, holder_number, void, checked_in_at, ticket_tiers(name, description), ticket_sales(buyer_name, buyer_email, quantity, status)")
    .eq("code", code)
    .maybeSingle<Row>();
  if (error) throw new Error(error.message);
  if (!t) return { kind: "not_found", code };
  const voided = t.void || t.ticket_sales?.status !== "paid";
  return {
    kind: voided ? "void" : t.checked_in_at ? "checked_in" : "valid",
    code: t.code,
    holderName: t.ticket_sales?.buyer_name ?? "Unknown",
    email: t.ticket_sales?.buyer_email ?? "",
    tierName: t.ticket_tiers?.name ?? "Ticket",
    perk: t.ticket_tiers?.description ?? null,
    holderNumber: t.holder_number,
    ofQuantity: t.ticket_sales?.quantity ?? 1,
    checkedInAt: t.checked_in_at,
  };
}

/**
 * Marks a ticket as used. One UPDATE that only matches an unused, valid ticket, so if two phones
 * scan the same ticket at once only one succeeds; the other then sees "already verified".
 */
export async function checkInTicket(raw: string): Promise<ScanResult> {
  const code = normaliseCode(raw);
  const before = await lookupTicket(code);
  if (before.kind !== "valid") return before;
  const { error } = await supabase()
    .from("tickets")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("code", code)
    .is("checked_in_at", null)
    .eq("void", false);
  if (error) throw new Error(error.message);
  return lookupTicket(code);
}

/** Lets a ticket back in after a mistaken verify. */
export async function undoCheckIn(raw: string): Promise<ScanResult> {
  const code = normaliseCode(raw);
  const { error } = await supabase().from("tickets").update({ checked_in_at: null }).eq("code", code);
  if (error) throw new Error(error.message);
  return lookupTicket(code);
}

/** Tickets that count for the door: paid orders, not voided. */
export async function checkInStats() {
  const { data, error } = await supabase()
    .from("tickets")
    .select("checked_in_at, void, ticket_sales!inner(status)")
    .eq("void", false)
    .eq("ticket_sales.status", "paid");
  if (error) throw new Error(error.message);
  const rows = data as { checked_in_at: string | null }[];
  return { issued: rows.length, checkedIn: rows.filter((r) => r.checked_in_at).length };
}
