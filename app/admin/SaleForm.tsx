"use client";

import { useActionState, useEffect, useState } from "react";
import { formatNaira, MANUAL_METHODS, PAYMENT_METHODS } from "@/lib/ticket-types";
import { recordSaleAction, type SaleFormState } from "./actions";

type TierOption = { id: string; name: string; priceNaira: number; remaining: number; hidden: boolean };

export type { TierOption };

export function SaleForm({ tiers, onSaved }: { tiers: TierOption[]; onSaved?: () => void }) {
  const [state, action, pending] = useActionState<SaleFormState, FormData>(recordSaleAction, {});
  useEffect(() => {
    if (state.saved) onSaved?.();
  }, [state.saved, onSaved]);
  if (tiers.length === 0) return <p className="admin-muted">Add a ticket tier first.</p>;
  // Re-keyed after each save so the fields and the live total start fresh.
  return (
    <SaleFields key={state.saved ?? 0} tiers={tiers} state={state} action={action} pending={pending} inDialog={Boolean(onSaved)} />
  );
}

function SaleFields({
  tiers,
  state,
  action,
  pending,
  inDialog,
}: {
  tiers: TierOption[];
  state: SaleFormState;
  action: (form: FormData) => void;
  pending: boolean;
  inDialog: boolean;
}) {
  const errors = state.errors ?? {};
  const v = state.values;
  const [tierId, setTierId] = useState(v?.tierId ?? "");
  const [qty, setQty] = useState(v?.quantity ?? "1");
  const tier = tiers.find((t) => t.id === tierId);
  const total = tier && /^\d+$/.test(qty) ? tier.priceNaira * Number(qty) : null;

  return (
    <form action={action} className="admin-form" noValidate>
      <Field label="Ticket" error={errors.tierId}>
        <select name="tierId" defaultValue={v?.tierId ?? ""} onChange={(e) => setTierId(e.target.value)} required>
          <option value="" disabled>
            Choose a tier
          </option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id} disabled={t.remaining === 0}>
              {t.name} · {formatNaira(t.priceNaira)} · {t.remaining === 0 ? "sold out" : `${t.remaining} left`}
              {t.hidden ? " (hidden)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Field label="How many" error={errors.quantity}>
        <input name="quantity" inputMode="numeric" defaultValue={v?.quantity ?? "1"} onChange={(e) => setQty(e.target.value)} required />
      </Field>
      <Field label="Buyer's name" error={errors.buyerName}>
        <input name="buyerName" defaultValue={v?.buyerName} autoComplete="off" required />
      </Field>
      <Field label="Buyer's email" error={errors.buyerEmail}>
        <input name="buyerEmail" type="email" defaultValue={v?.buyerEmail} autoComplete="off" required />
      </Field>
      <Field label="Paid by" error={errors.paymentMethod}>
        <select name="paymentMethod" defaultValue={v?.paymentMethod ?? "transfer"} required>
          {MANUAL_METHODS.map((value) => (
            <option key={value} value={value}>
              {PAYMENT_METHODS[value]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Note (optional)" error={errors.note}>
        <input name="note" defaultValue={v?.note} placeholder="e.g. transfer ref" maxLength={300} />
      </Field>

      {errors.form && <p className="admin-error admin-wide" role="alert">{errors.form}</p>}
      <div className="admin-actions admin-wide">
        <button className="admin-btn" disabled={pending}>
          {pending ? "Recording…" : total !== null ? `Record sale · ${formatNaira(total)}` : "Record sale"}
        </button>
        {state.saved && !pending && !inDialog && <span className="admin-ok">Sale recorded</span>}
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="admin-field" data-invalid={error ? "" : undefined}>
      <span>{label}</span>
      {children}
      {error && <small className="admin-error">{error}</small>}
    </label>
  );
}
