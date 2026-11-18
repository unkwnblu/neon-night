"use client";

import { useActionState } from "react";
import { isoToLagosLocal, type TicketTier } from "@/lib/ticket-types";
import { removeTier, saveTier, type DeleteState, type TierFormState } from "./actions";

/** Edits an existing tier, or creates a new one when `tier` is omitted. */
export function TierEditor({ tier }: { tier?: TicketTier }) {
  const [state, action, pending] = useActionState<TierFormState, FormData>(saveTier, {});
  const [deleteState, deleteAction, deleting] = useActionState<DeleteState, FormData>(removeTier, {});
  const errors = state.errors ?? {};
  // After a failed save, refill with what was typed; otherwise show the saved tier (or blanks).
  const v = state.values;
  const val = (field: string, saved: string | number | undefined | null) => v?.[field] ?? (saved == null ? "" : String(saved));

  return (
    <form action={action} className="admin-form" noValidate>
      {tier && <input type="hidden" name="id" value={tier.id} />}
      <Field label="Name" error={errors.name} wide>
        <input name="name" defaultValue={val("name", tier?.name)} placeholder="Early Bird" maxLength={60} required />
      </Field>
      <Field label="Price (₦)" error={errors.priceNaira}>
        <input name="price" inputMode="numeric" defaultValue={val("price", tier?.priceNaira)} placeholder="5000" required />
      </Field>
      <Field label="Quantity" error={errors.quantity}>
        <input name="quantity" inputMode="numeric" defaultValue={val("quantity", tier?.quantity)} placeholder="200" required />
      </Field>
      <Field label="Goes on sale (Lagos time)" error={errors.salesStart}>
        <input type="datetime-local" name="salesStart" defaultValue={val("salesStart", isoToLagosLocal(tier?.salesStart ?? null))} required />
      </Field>
      <Field label="Sales end (optional)" error={errors.salesEnd}>
        <input type="datetime-local" name="salesEnd" defaultValue={val("salesEnd", isoToLagosLocal(tier?.salesEnd ?? null))} />
      </Field>
      <Field label="Description (optional)" error={errors.description} wide>
        <input name="description" defaultValue={val("description", tier?.description)} placeholder="Limited first release" maxLength={200} />
      </Field>
      <Field label="Order on page" error={errors.sortOrder}>
        <input name="sortOrder" inputMode="numeric" defaultValue={val("sortOrder", tier?.sortOrder ?? 0)} />
      </Field>
      <label className="admin-check">
        <input type="checkbox" name="hidden" defaultChecked={v ? v.hidden === "on" : tier?.hidden} />
        <span>Hide from the public page</span>
      </label>

      {errors.form && <p className="admin-error admin-wide" role="alert">{errors.form}</p>}
      {deleteState.error && <p className="admin-error admin-wide" role="alert">{deleteState.error}</p>}
      <div className="admin-actions admin-wide">
        <button className="admin-btn" disabled={pending}>
          {pending ? "Saving…" : tier ? "Save changes" : "Add tier"}
        </button>
        {state.saved && !pending && <span className="admin-ok">Saved</span>}
        {tier && (
          <button
            className="admin-btn admin-btn-danger"
            formAction={deleteAction}
            disabled={deleting}
            formNoValidate
            onClick={(e) => {
              if (!confirm(`Delete "${tier.name}"? This can't be undone.`)) e.preventDefault();
            }}
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  wide,
  children,
}: {
  label: string;
  error?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`admin-field ${wide ? "admin-wide" : ""}`} data-invalid={error ? "" : undefined}>
      <span>{label}</span>
      {children}
      {error && <small className="admin-error">{error}</small>}
    </label>
  );
}
