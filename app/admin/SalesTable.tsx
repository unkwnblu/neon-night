"use client";

import { useMemo, useState } from "react";
import { formatLagos, formatNaira, PAYMENT_METHODS, type Sale } from "@/lib/ticket-types";
import { refundSaleAction, resendEmailsAction } from "./actions";
import { IconSearch } from "./ui/Icons";

const PAGE = 50;
type Filter = "all" | Sale["status"];
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["paid", "Paid"],
  ["pending", "Awaiting payment"],
  ["refunded", "Refunded"],
  ["expired", "Expired"],
];

export function SalesTable({ sales }: { sales: Sale[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!q || `${s.buyerName} ${s.buyerEmail} ${s.tierName} ${s.note ?? ""}`.toLowerCase().includes(q)),
    );
  }, [sales, query, filter]);

  if (sales.length === 0) {
    return (
      <div className="ad-card ad-empty ad-empty-lg">
        <p>No sales yet</p>
        <span>Every sale you record shows up here, with the buyer&apos;s details and a refund option.</span>
      </div>
    );
  }

  return (
    <section className="ad-card ad-card-flush">
      <div className="ad-toolbar">
        <label className="ad-search">
          <IconSearch />
          <input
            type="search"
            placeholder="Search name, email, tier or note"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(PAGE);
            }}
            aria-label="Search sales"
          />
        </label>
        <div className="ad-segmented" role="group" aria-label="Filter by status">
          {FILTERS.map(([f, label]) => (
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
              <th scope="col" className="num">Qty</th>
              <th scope="col" className="num">Total</th>
              <th scope="col">Paid by</th>
              <th scope="col">Date</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {matches.slice(0, shown).map((s) => (
              <tr key={s.id} className={s.status === "paid" || s.status === "pending" ? undefined : "is-refunded"}>
                <td>
                  <b className="ad-cell-main">{s.buyerName}</b>
                  <small>{s.buyerEmail}</small>
                  {s.status === "paid" &&
                    (s.emailError && !s.emailed ? (
                      <small className="ad-email-bad" title={s.emailError}>
                        Email failed
                      </small>
                    ) : s.emailed ? (
                      <small className="ad-email-ok">Tickets emailed</small>
                    ) : (
                      <small>Not emailed yet</small>
                    ))}
                  {s.oversold && (
                    <span className="ad-pill ad-pill-soldout" title="Paid after this tier was already full. Refund it, or raise the tier's quantity.">
                      Oversold
                    </span>
                  )}
                </td>
                <td>
                  <span className="ad-cell-main">{s.tierName}</span>
                  {s.publicity && <span className="ad-pill ad-pill-publicity">Publicity</span>}
                  {s.note && <small>{s.note}</small>}
                </td>
                <td className="num">{s.quantity}</td>
                <td className="num ad-amount">{formatNaira(s.totalNaira)}</td>
                <td>{PAYMENT_METHODS[s.paymentMethod]}</td>
                <td className="ad-nowrap ad-muted">{formatLagos(s.createdAt)}</td>
                <td className="ad-cell-action">
                  {s.status === "refunded" ? (
                    <span className="ad-pill">Refunded</span>
                  ) : s.status === "expired" ? (
                    <span className="ad-pill">Expired</span>
                  ) : s.status === "pending" ? (
                    <span className="ad-pill ad-pill-upcoming">Awaiting payment</span>
                  ) : (
                    <div className="ad-row-actions">
                    <form action={resendEmailsAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        className="ad-btn ad-btn-quiet ad-btn-sm"
                        onClick={(e) => {
                          if (!confirm(`Send ${s.buyerName} their receipt and tickets again at ${s.buyerEmail}?`)) e.preventDefault();
                        }}
                      >
                        {s.emailed ? "Resend emails" : "Send emails"}
                      </button>
                    </form>
                    <form action={refundSaleAction}>
                      <input type="hidden" name="id" value={s.id} />
                      <button
                        className="ad-btn ad-btn-quiet ad-btn-sm"
                        onClick={(e) => {
                          const msg =
                            s.source === "online"
                              ? `Mark ${s.buyerName}'s ${s.quantity} × ${s.tierName} as refunded? This only updates the records and puts the tickets back on sale. Send the money back from your Bachs dashboard.`
                              : `Refund ${s.buyerName}'s ${s.quantity} × ${s.tierName}? The tickets go back on sale.`;
                          if (!confirm(msg)) e.preventDefault();
                        }}
                      >
                        {s.source === "online" ? "Mark refunded" : "Refund"}
                      </button>
                    </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {matches.length === 0 && (
              <tr>
                <td colSpan={7} className="ad-muted ad-center">
                  No sales match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <footer className="ad-table-foot">
        <span>
          Showing {Math.min(shown, matches.length)} of {matches.length}
        </span>
        {matches.length > shown && (
          <button className="ad-btn ad-btn-quiet ad-btn-sm" onClick={() => setShown((n) => n + PAGE)}>
            Show more
          </button>
        )}
      </footer>
    </section>
  );
}
