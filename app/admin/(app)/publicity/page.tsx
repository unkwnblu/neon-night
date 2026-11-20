import { Suspense } from "react";
import { requireOwner } from "@/lib/admin-auth";
import { getDashboard } from "@/lib/sales";
import { formatNaira } from "@/lib/ticket-types";
import { IconWallet } from "../../ui/Icons";
import { Card, PageHeader, PageSkeleton } from "../../ui/PageHeader";
import { checkSetup } from "../../ui/setup";
import { PublicityTable } from "./PublicityTable";

// Neutral title: the page shell is served before the owner check redirects anyone else.
export const metadata = { title: "Neon Night admin" };

export default function PublicityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Publicity />
    </Suspense>
  );
}

const naira = (n: number) => (n ? formatNaira(n) : "₦0");

async function Publicity() {
  const notice = await checkSetup();
  if (notice) return notice;
  await requireOwner();
  const { sales, totals } = await getDashboard({ owner: true });
  const paid = sales.filter((s) => s.status === "paid");

  return (
    <>
      <PageHeader
        title="Publicity fund"
        subtitle="Owner only. Sales moved here leave the revenue admins see, but their tickets still count as sold and work at the door."
      />
      <div className="ad-kpis ad-kpis-3">
        <Fig label="Total collected" value={naira(totals.revenue)} note={`${totals.orders} paid orders`} />
        <Fig
          label="Publicity fund"
          value={naira(totals.publicity)}
          note={`${totals.publicityOrders} order${totals.publicityOrders === 1 ? "" : "s"} · owner only`}
          accent
        />
        <Fig label="Main account" value={naira(totals.mainBalance)} note="What admins see as revenue" />
      </div>
      <Card title="Paid sales" subtitle="Move a sale into the publicity fund, or back to the main account.">
        <PublicityTable sales={paid} />
      </Card>
    </>
  );
}

function Fig({ label, value, note, accent = false }: { label: string; value: string; note: string; accent?: boolean }) {
  return (
    <div className={`ad-card ad-kpi ${accent ? "ad-kpi-accent" : ""}`}>
      <span className="ad-kpi-label">
        <span className="ad-kpi-icon">
          <IconWallet />
        </span>
        {label}
      </span>
      <b>{value}</b>
      <small>{note}</small>
    </div>
  );
}
