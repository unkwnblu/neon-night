import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Bachs (https://docs.bachs.io): hosted checkout + signed webhooks.
// Amounts are decimal strings in naira ("3500.00"), never kobo.

export function isBachsConfigured() {
  return Boolean(process.env.BACHS_API_KEY && process.env.BACHS_WEBHOOK_SECRET);
}

function apiUrl() {
  if (process.env.BACHS_API_URL) return process.env.BACHS_API_URL;
  return process.env.BACHS_API_KEY?.startsWith("sk_live_") ? "https://api.bachs.io" : "https://sandbox-api.bachs.io";
}

export type NewCheckout = {
  /** Our order id; also sent as the idempotency key so a retry can't create a second checkout. */
  reference: string;
  amountNaira: number;
  customer: { email: string; name: string };
  successUrl: string;
  cancelUrl: string;
  expiresInMinutes: number;
  metadata: Record<string, string>;
};

export async function createCheckout(c: NewCheckout): Promise<{ checkoutId: string; checkoutUrl: string }> {
  const res = await fetch(`${apiUrl()}/v1/checkout-sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.BACHS_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": c.reference,
    },
    body: JSON.stringify({
      pricing: { currency: "NGN", amount: c.amountNaira.toFixed(2) },
      billing_currency: "NGN",
      customer: c.customer,
      success_url: c.successUrl,
      cancel_url: c.cancelUrl,
      reference: c.reference,
      metadata: c.metadata,
      expires_in_minutes: c.expiresInMinutes,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    checkout_id?: string;
    checkout_url?: string;
    error_code?: string;
    message?: string;
  };
  if (!res.ok || !body.checkout_id || !body.checkout_url) {
    throw new Error(`Bachs checkout failed (${res.status}${body.error_code ? ` ${body.error_code}` : ""}${body.message ? `: ${body.message}` : ""})`);
  }
  return { checkoutId: body.checkout_id, checkoutUrl: body.checkout_url };
}

export type BachsEvent = {
  id: string;
  type: string;
  created_at: string;
  data: {
    checkout_id?: string | null;
    reference?: string | null;
    payment_status?: string;
    status?: string;
    amount?: string;
    currency?: string;
    metadata?: Record<string, string>;
  };
};

const TOLERANCE_SECONDS = 300;

/**
 * Checks the X-Bachs-Signature-V2 header ("t=<unix>,v1=<hex>[,v1=<hex>]"): HMAC-SHA256 of
 * "<t>.<raw body>" with the endpoint's signing secret. Throws if it doesn't match or is stale.
 */
export function verifyWebhook(
  rawBody: string,
  header: string | null,
  nowSeconds: number,
  timestampHeader: string | null = null,
): BachsEvent {
  if (!header) throw new Error("Missing signature");
  let timestamp = "";
  const signatures: string[] = [];
  if (header.includes("=")) {
    for (const part of header.split(",")) {
      const [key, value] = part.trim().split("=", 2);
      if (key === "t") timestamp = value;
      else if (key === "v1" && value) signatures.push(value);
    }
  } else {
    // Older single-value form: just the hex digest, with the time in X-Bachs-Timestamp.
    signatures.push(header.trim());
    timestamp = timestampHeader?.trim() ?? "";
  }
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) throw new Error("Malformed signature");
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) throw new Error("Signature too old");

  const expected = Buffer.from(
    createHmac("sha256", process.env.BACHS_WEBHOOK_SECRET!).update(`${timestamp}.${rawBody}`).digest("hex"),
  );
  const ok = signatures.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!ok) throw new Error("Signature mismatch");
  return JSON.parse(rawBody) as BachsEvent;
}
