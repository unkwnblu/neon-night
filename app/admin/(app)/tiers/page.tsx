import { Suspense } from "react";
import { getDashboard } from "@/lib/sales";
import { formatLagos, formatNaira, tierStatus } from "@/lib/ticket-types";
import { TierEditor } from "../../TierEditor";
import { IconPlus } from "../../ui/Icons";
import { PageHeader, PageSkeleton } from "../../ui/PageHeader";
import { checkSetup, viewerIsOwner } from "../../ui/setup";

export const metadata = { title: "Tiers | Neon Night admin" };

export default function TiersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Tiers />
    </Suspense>
  );
}

const LABEL = { upcoming: "Upcoming", "on-sale": "On sale", ended: "Ended", soldout: "Sold out" } as const;

async function Tiers() {
  const notice = await checkSetup();
  if (notice) return notice;
  const { tiers, loadedAt: now } = await getDashboard({ owner: await viewerIsOwner() });
  return (
    <>
      <PageHeader title="Tiers" subtitle="Prices, how many are available and when each goes on sale." />
      <div className="ad-tier-list">
        {tiers.map((t) => {
          const status = t.remaining === 0 ? "soldout" : tierStatus(t, now);
          return (
            <details key={t.id} className="ad-card ad-tier-card">
              <summary>
                <div className="ad-tier-card-main">
                  <div className="ad-tier-top">
                    <span className="ad-tier-name">{t.name}</span>
                    <span className={`ad-pill ad-pill-${status}`}>{LABEL[status]}</span>
                    {t.hidden && <span className="ad-pill">Hidden</span>}
                  </div>
                  <div className="ad-tier-sub">
                    On sale {formatLagos(t.salesStart)}
                    {t.salesEnd && <> – {formatLagos(t.salesEnd)}</>}
                    {t.description && <> · {t.description}</>}
                  </div>
                </div>
                <dl className="ad-tier-stats">
                  <div>
                    <dt>Price</dt>
                    <dd>{formatNaira(t.priceNaira)}</dd>
                  </div>
                  <div>
                    <dt>Sold</dt>
                    <dd>
                      {t.sold} / {t.quantity}
                    </dd>
                  </div>
                  <div>
                    <dt>Left</dt>
                    <dd>{t.remaining}</dd>
                  </div>
                </dl>
                <span className="ad-chevron" aria-hidden />
              </summary>
              <div className="ad-tier-edit">
                <TierEditor tier={t} />
              </div>
            </details>
          );
        })}
        <details className="ad-card ad-tier-card ad-tier-new" open={tiers.length === 0}>
          <summary>
            <span className="ad-tier-new-label">
              <IconPlus />
              New tier
            </span>
          </summary>
          <div className="ad-tier-edit">
            <TierEditor />
          </div>
        </details>
      </div>
    </>
  );
}
