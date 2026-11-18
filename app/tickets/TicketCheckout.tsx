"use client";

import { useActionState, useEffect, useState } from "react";
import { formatLagos, formatNaira, MAX_PER_ORDER, tierStatus, type PublicTier } from "@/lib/ticket-types";
import { startCheckout, type CheckoutState } from "./actions";

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now;
}

function until(iso: string, now: number) {
  const s = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor(s / 3600) % 24;
  const m = Math.floor(s / 60) % 60;
  return d ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

export function TicketCheckout({ tiers, paymentsOpen }: { tiers: PublicTier[]; paymentsOpen: boolean }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(startCheckout, {});
  const now = useNow();
  const v = state.values;
  const errors = state.errors ?? {};

  const buyable = (t: PublicTier) => now !== null && t.remaining > 0 && tierStatus(t, now) === "on-sale";
  const [picked, setTierId] = useState(v?.tierId ?? "");
  const [qty, setQty] = useState(Number(v?.quantity ?? 1));
  // Until the buyer picks, default to the first tier that's on sale.
  const tierId = picked || (now === null ? "" : (tiers.find(buyable)?.id ?? ""));
  const tier = tiers.find((t) => t.id === tierId);
  const max = tier ? Math.min(MAX_PER_ORDER, tier.remaining) : MAX_PER_ORDER;
  const total = tier ? tier.priceNaira * qty : 0;

  const anyOnSale = tiers.some(buyable);
  const nextOpen = tiers
    .filter((t) => now !== null && t.remaining > 0 && tierStatus(t, now) === "upcoming")
    .map((t) => t.salesStart)
    .sort()[0];

  return (
    <form action={action} className="tk-form" noValidate>
      <fieldset className="tk-tiers">
        <legend>Choose your ticket</legend>
        {tiers.map((t) => {
          const status = now === null ? null : tierStatus(t, now);
          const soldOut = t.remaining === 0;
          const disabled = !buyable(t);
          return (
            <label key={t.id} className="tk-tier" data-disabled={disabled ? "" : undefined}>
              <input
                type="radio"
                name="tierId"
                value={t.id}
                checked={tierId === t.id}
                disabled={disabled}
                onChange={() => {
                  setTierId(t.id);
                  setQty((q) => Math.min(q, Math.max(1, Math.min(MAX_PER_ORDER, t.remaining))));
                }}
              />
              <span className="tk-tier-body">
                <span className="tk-tier-name">{t.name}</span>
                {t.description && <span className="tk-tier-perk">{t.description}</span>}
                <span className="tk-tier-state">
                  {soldOut
                    ? "Sold out"
                    : status === "upcoming"
                      ? `Opens in ${until(t.salesStart, now!)}`
                      : status === "ended"
                        ? "Sales closed"
                        : status === "on-sale"
                          ? t.remaining <= 5
                            ? `Only ${t.remaining} left`
                            : "On sale"
                          : ""}
                </span>
              </span>
              <span className="tk-tier-price">{formatNaira(t.priceNaira)}</span>
            </label>
          );
        })}
        {errors.tierId && <small className="tk-error">{errors.tierId}</small>}
      </fieldset>

      {!anyOnSale && now !== null && (
        <p className="tk-note">
          {nextOpen ? `Tickets go on sale ${formatLagos(nextOpen)}.` : "No tickets are on sale right now."}
        </p>
      )}

      <div className="tk-qty">
        <span>How many</span>
        <div className="tk-stepper">
          <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="One fewer">
            −
          </button>
          <output aria-live="polite">{qty}</output>
          <button type="button" onClick={() => setQty((q) => Math.min(max, q + 1))} disabled={qty >= max} aria-label="One more">
            +
          </button>
        </div>
        <input type="hidden" name="quantity" value={qty} />
        {errors.quantity && <small className="tk-error">{errors.quantity}</small>}
      </div>

      <div className="tk-fields">
        <label className="tk-field">
          <span>Full name</span>
          <input name="buyerName" defaultValue={v?.buyerName} autoComplete="name" required />
          {errors.buyerName && <small className="tk-error">{errors.buyerName}</small>}
        </label>
        <label className="tk-field">
          <span>Email</span>
          <input name="buyerEmail" type="email" defaultValue={v?.buyerEmail} autoComplete="email" required />
          {errors.buyerEmail && <small className="tk-error">{errors.buyerEmail}</small>}
        </label>
      </div>

      {errors.form && (
        <p className="tk-error tk-error-box" role="alert">
          {errors.form}
        </p>
      )}

      <div className="tk-pay">
        <div>
          <span>Total</span>
          <b>{tier ? formatNaira(total).replace("Free", "₦0") : "—"}</b>
        </div>
        <button className="switch" disabled={pending || !tier || !buyable(tier) || !paymentsOpen}>
          {pending ? "Starting payment…" : paymentsOpen ? "Pay securely" : "Payments open soon"}
        </button>
      </div>
      <p className="tk-fine">
        You&apos;ll pay on Bachs&apos; secure checkout. Your tickets are held for 30 minutes while you pay.
      </p>
    </form>
  );
}
