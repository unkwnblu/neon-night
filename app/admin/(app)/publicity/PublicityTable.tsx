"use client";

import { useMemo, useState } from "react";
import { formatLagos, formatNaira, PAYMENT_METHODS, type Sale } from "@/lib/ticket-types";
import { setPublicityAction } from "../../actions";
import { IconSearch } from "../../ui/Icons";

type Filter = "all" | "publicity" | "main";

export function PublicityTable({ sales }: { sales: Sale[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter(
      (s) =>
        (filter === "all" || (filter === "publicity") === s.publicity) &&
        (!q || `${s.buyerName} ${s.buyerEmail} ${s.tierName} ${s.publicityNote ?? ""}`.toLowerCase().includes(q)),
    );
  }, [sales, query, filter]);

  if (sales.length === 0) {
    return (
      <div className="ad-empty">
        <p>No paid sales yet</p>
        <span>Once tickets sell, you can move sales into the publicity fund here.</span>
      </div>
    );
  }

  return (
    <div className="ad-pub">
      <div className="ad-toolbar ad-toolbar-inline">
        <label className="ad-search">
          <IconSearch />
          <input type="search" placeholder="Search name, email, tier or note" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search sales" />
        </label>
        <div className="ad-segmented" role="group" aria-label="Filter">
          {(
            [
              ["all", "All"],
              ["publicity", "Publicity"],
              ["main", "Main account"],
            ] as const
          ).map(([f, label]) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th scope="col">Buyer</th>
              <th scope="col">Ticket</th>
              <th scope="col" className="num">Total</th>
              <th scope="col">Paid</th>
              <th scope="col">Account</th>
              <th scope="col">
                <span className="sr-only">Move</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <b className="ad-cell-main">{s.buyerName}</b>
                  <small>{s.buyerEmail}</small>
                </td>
                <td>
                  <span className="ad-cell-main">
                    {s.quantity} × {s.tierName}
                  </span>
                  <small>{PAYMENT_METHODS[s.paymentMethod]}</small>
                </td>
                <td className="num ad-amount">{formatNaira(s.totalNaira)}</td>
                <td className="ad-nowrap ad-muted">{formatLagos(s.createdAt)}</td>
                <td>
                  {s.publicity ? (
                    <>
                      <span className="ad-pill ad-pill-publicity">Publicity</span>
                      {s.publicityNote && <small>{s.publicityNote}</small>}
                    </>
                  ) : (
                    <span className="ad-pill">Main</span>
                  )}
                </td>
                <td className="ad-cell-action">
                  <form action={setPublicityAction} className="ad-pub-move">
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="on" value={s.publicity ? "0" : "1"} />
                    {!s.publicity && (
                      <input
                        name="note"
                        className="ad-pub-note"
                        placeholder="Note (optional)"
                        maxLength={200}
                        aria-label={`Note for ${s.buyerName}'s sale`}
                      />
                    )}
                    <button className="ad-btn ad-btn-quiet ad-btn-sm">{s.publicity ? "Move to main" : "Move to publicity"}</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="ad-muted ad-center">
                  No sales match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
