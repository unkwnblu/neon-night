"use server";

import { updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createCheckout, isBachsConfigured } from "@/lib/bachs";
import { supabase } from "@/lib/supabase";
import { parseCheckoutForm, type CheckoutErrors } from "@/lib/ticket-types";
import { TIERS_TAG } from "@/lib/tickets";

/** How long tickets are held while the buyer pays; the Bachs checkout expires at the same time. */
const HOLD_MINUTES = 30;

export type CheckoutState = { errors?: CheckoutErrors; values?: Record<string, string> };

async function siteOrigin() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function startCheckout(_prev: CheckoutState, form: FormData): Promise<CheckoutState> {
  const values = Object.fromEntries(
    [...form.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]),
  );
  if (!isBachsConfigured()) return { errors: { form: "Online payments aren't open yet. Check back soon." }, values };

  const { input, errors } = parseCheckoutForm(form);
  if (errors) return { errors, values };

  const db = supabase();
  // Holds the tickets, or refuses if the tier isn't on sale or doesn't have enough left.
  const { data: sale, error } = await db
    .rpc("reserve_online_sale", {
      p_tier_id: input.tierId,
      p_buyer_name: input.buyerName,
      p_buyer_email: input.buyerEmail,
      p_quantity: input.quantity,
      p_hold_minutes: HOLD_MINUTES,
    })
    .single<{ id: string; total_naira: number }>();
  if (error || !sale) {
    const friendly = error?.code === "P0001" || error?.code === "P0002";
    if (!friendly) console.error("Could not reserve tickets:", error?.message);
    return { errors: { form: friendly ? error!.message : "Something went wrong. Please try again." }, values };
  }

  const origin = await siteOrigin();
  let checkoutUrl: string;
  try {
    const checkout = await createCheckout({
      reference: sale.id,
      amountNaira: sale.total_naira,
      customer: { email: input.buyerEmail, name: input.buyerName },
      successUrl: `${origin}/tickets/success/${sale.id}`,
      cancelUrl: `${origin}/tickets?cancelled=1`,
      expiresInMinutes: HOLD_MINUTES,
      metadata: { sale_id: sale.id, quantity: String(input.quantity) },
    });
    await db.from("ticket_sales").update({ checkout_id: checkout.checkoutId }).eq("id", sale.id);
    checkoutUrl = checkout.checkoutUrl;
  } catch (e) {
    // Give the tickets straight back rather than holding them for 30 minutes.
    await db.from("ticket_sales").update({ status: "expired" }).eq("id", sale.id);
    console.error("Could not start Bachs checkout:", (e as Error).message);
    return { errors: { form: "We couldn't start the payment. Please try again in a moment." }, values };
  }

  updateTag(TIERS_TAG);
  redirect(checkoutUrl);
}
