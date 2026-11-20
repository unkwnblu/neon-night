import Link from "next/link";
import { Suspense } from "react";
import { getDashboard } from "@/lib/sales";
import { formatLagos, formatNaira, PAYMENT_METHODS } from "@/lib/ticket-types";
import { DailyChart } from "../ui/DailyChart";
import { IconBox, IconTicket, IconUsers, IconWallet } from "../ui/Icons";
import { LaunchCountdown } from "../ui/LaunchCountdown";
import { Card, PageHeader, PageSkeleton } from "../ui/PageHeader";
import { RecordSale } from "../ui/RecordSale";
import { checkSetup, viewerIsOwner } from "../ui/setup";

export default function OverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

const naira = (n: number) => (n ? formatNaira(n) : "₦0");

async function Overview() {
  const notice = await checkSetup();
  if (notice) return notice;

  const owner = await viewerIsOwner();
  const { tiers, sales, totals, byMethod, daily } = await getDashboard({ owner });
  const visible = tiers.filter((t) => !t.hidden);
  const firstDrop = visible.map((t) => t.salesStart).sort()[0];
  const pct = totals.capacity ? Math.round((totals.sold / totals.capacity) * 100) : 0;
  const recent = sales.slice(0, 6);
  const avgOrder = totals.orders ? Math.round(totals.revenue / totals.orders) : 0;
  const methodTotal = byMethod.reduce((n, m) => n + m.revenue, 0);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Ticket sales for Neon Night at a glance."
        action={<RecordSale tiers={tiers.map(({ id, name, priceNaira, remaining, hidden }) => ({ id, name, priceNaira, remaining, hidden }))} />}
      />

      {totals.oversold > 0 && (
        <p className="ad-alert" role="alert">
          <b>
            {totals.oversold} online order{totals.oversold === 1 ? " was" : "s were"} paid after the tier sold out.
          </b>{" "}
          Find {totals.oversold === 1 ? "it" : "them"} under <Link href="/admin/sales">Sales</Link> (marked Oversold) and either
          refund in Bachs or raise the tier&apos;s quantity.
        </p>
      )}

      {owner && totals.publicity > 0 && (
        <p className="ad-owner-note">
          <span className="ad-pill ad-pill-publicity">Owner view</span> Revenue includes{" "}
          <b>{naira(totals.publicity)}</b> in the publicity fund. Admins see the main account:{" "}
          <b>{naira(totals.mainBalance)}</b>. <Link href="/admin/publicity">Manage</Link>
        </p>
      )}

      <section className="ad-hero">
        <div className="ad-hero-status">
          <span className="ad-eyebrow">{firstDrop ? "Tickets go live" : "Tickets"}</span>
          {firstDrop ? (
            <>
              <LaunchCountdown to={firstDrop} live={<span className="ad-live">● Sales are open</span>} />
              <p>{formatLagos(firstDrop)}, Lagos time</p>
            </>
          ) : (
            <p className="ad-hero-empty">
              No visible tiers yet. <Link href="/admin/tiers">Add a tier</Link> to set when tickets go live.
            </p>
          )}
        </div>
        <div className="ad-hero-progress">
          <div className="ad-hero-figure">
            <b>{pct}%</b>
            <span>
              sold · {totals.sold.toLocaleString("en-NG")} of {totals.capacity.toLocaleString("en-NG")} tickets
            </span>
          </div>
          <div className="ad-stackbar" role="img" aria-label={`${totals.sold} of ${totals.capacity} tickets sold`}>
            {tiers.map((t) =>
              t.sold ? (
                <span key={t.id} style={{ width: `${(t.sold / Math.max(totals.capacity, 1)) * 100}%` }} title={`${t.name}: ${t.sold}`} />
              ) : null,
            )}
          </div>
        </div>
      </section>

      <div className="ad-kpis">
        <Kpi icon={<IconWallet />} label="Revenue" value={naira(totals.revenue)} note={totals.refunds ? `${totals.refunds} refunded` : "After refunds"} />
        <Kpi icon={<IconTicket />} label="Tickets sold" value={totals.sold.toLocaleString("en-NG")} note={`of ${totals.capacity.toLocaleString("en-NG")} available`} />
        <Kpi
          icon={<IconBox />}
          label="Tickets left"
          value={totals.remaining.toLocaleString("en-NG")}
          note={totals.held ? `${totals.held} held in checkout` : `across ${tiers.length} tier${tiers.length === 1 ? "" : "s"}`}
        />
        <Kpi
          icon={<IconUsers />}
          label="Orders"
          value={totals.orders.toLocaleString("en-NG")}
          note={totals.orders ? `${totals.online} online · ${naira(avgOrder)} avg` : "No orders yet"}
        />
      </div>

      <Card title="Daily sales" subtitle="Tickets sold per day, Lagos time">
        <DailyChart points={daily} />
      </Card>

      <div className="ad-grid ad-grid-wide">
        <Card title="Recent sales" action={sales.length ? <Link className="ad-link" href="/admin/sales">View all</Link> : undefined}>
          {recent.length === 0 ? (
            <div className="ad-empty">
              <p>No sales yet</p>
              <span>Use “Record sale” when someone pays by cash, transfer or POS.</span>
            </div>
          ) : (
            <ul className="ad-recent">
              {recent.map((s) => (
                <li key={s.id} className={s.status === "paid" || s.status === "pending" ? undefined : "is-refunded"}>
                  <span className="ad-avatar" aria-hidden>
                    {s.buyerName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <span className="ad-recent-who">
                    <b>{s.buyerName}</b>
                    <small>
                      {s.quantity} × {s.tierName} · {formatLagos(s.createdAt)}
                    </small>
                  </span>
                  <span className="ad-recent-amt">
                    {s.status === "paid" ? (
                      formatNaira(s.totalNaira)
                    ) : (
                      <span className={`ad-pill ${s.status === "pending" ? "ad-pill-upcoming" : ""}`}>
                        {s.status === "pending" ? "Awaiting payment" : s.status === "expired" ? "Expired" : "Refunded"}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Payment methods" subtitle="Share of revenue">
          {byMethod.length === 0 ? (
            <p className="ad-muted">Nothing yet.</p>
          ) : (
            <ul className="ad-methods">
              {byMethod.map((m) => (
                <li key={m.method}>
                  <div className="ad-tier-top">
                    <span>{PAYMENT_METHODS[m.method]}</span>
                    <b>{formatNaira(m.revenue)}</b>
                  </div>
                  <div className="ad-meter ad-meter-thin">
                    <span style={{ width: `${(m.revenue / Math.max(methodTotal, 1)) * 100}%` }} />
                  </div>
                  <small>
                    {m.orders} order{m.orders === 1 ? "" : "s"} · {Math.round((m.revenue / Math.max(methodTotal, 1)) * 100)}%
                  </small>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Kpi({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="ad-card ad-kpi">
      <span className="ad-kpi-label">
        <span className="ad-kpi-icon">{icon}</span>
        {label}
      </span>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}
