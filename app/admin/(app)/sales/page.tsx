import { Suspense } from "react";
import { getDashboard } from "@/lib/sales";
import { formatNaira } from "@/lib/ticket-types";
import { SalesTable } from "../../SalesTable";
import { PageHeader, PageSkeleton } from "../../ui/PageHeader";
import { RecordSale } from "../../ui/RecordSale";
import { checkSetup, viewerIsOwner } from "../../ui/setup";

export const metadata = { title: "Sales | Neon Night admin" };

export default function SalesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Sales />
    </Suspense>
  );
}

async function Sales() {
  const notice = await checkSetup();
  if (notice) return notice;
  const { tiers, sales, totals } = await getDashboard({ owner: await viewerIsOwner() });
  return (
    <>
      <PageHeader
        title="Sales"
        subtitle={`${totals.orders} order${totals.orders === 1 ? "" : "s"} · ${totals.sold} tickets · ${totals.revenue ? formatNaira(totals.revenue) : "₦0"}`}
        action={<RecordSale tiers={tiers.map(({ id, name, priceNaira, remaining, hidden }) => ({ id, name, priceNaira, remaining, hidden }))} />}
      />
      <SalesTable sales={sales} />
    </>
  );
}
