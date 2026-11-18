"use client";

import { useCallback, useRef, useState } from "react";
import { SaleForm, type TierOption } from "../SaleForm";
import { IconClose, IconPlus } from "./Icons";

/** "Record sale" button that opens the sale form in a dialog, and closes it once the sale is saved. */
export function RecordSale({ tiers }: { tiers: TierOption[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [toast, setToast] = useState(false);
  // Re-keyed each time it opens so the form starts empty.
  const [openCount, setOpenCount] = useState(0);

  const onSaved = useCallback(() => {
    dialog.current?.close();
    setToast(true);
    setTimeout(() => setToast(false), 3000);
  }, []);

  return (
    <>
      <button
        className="ad-btn ad-btn-primary"
        onClick={() => {
          setOpenCount((n) => n + 1);
          dialog.current?.showModal();
        }}
      >
        <IconPlus />
        Record sale
      </button>
      <dialog
        ref={dialog}
        className="ad-dialog"
        aria-labelledby="record-sale-title"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="ad-dialog-body">
          <header className="ad-dialog-head">
            <div>
              <h2 id="record-sale-title">Record a sale</h2>
              <p>For cash, transfer or POS payments you&apos;ve received.</p>
            </div>
            <button className="ad-icon-btn" onClick={() => dialog.current?.close()} aria-label="Close">
              <IconClose />
            </button>
          </header>
          <SaleForm key={openCount} tiers={tiers} onSaved={onSaved} />
        </div>
      </dialog>
      {toast && (
        <p className="ad-toast" role="status">
          Sale recorded
        </p>
      )}
    </>
  );
}
