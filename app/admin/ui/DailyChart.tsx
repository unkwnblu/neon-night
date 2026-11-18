import type { DayPoint } from "@/lib/sales";
import { formatDay, formatNaira } from "@/lib/ticket-types";

/** Rounds the axis top up to a tidy number so gridlines land on whole values. */
function niceMax(n: number) {
  if (n <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / (step / 2)) * (step / 2);
}

/** Tickets sold per day. Single series, so no legend; hover or focus a bar for its figures. */
export function DailyChart({ points }: { points: DayPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="ad-chart-empty">
        <p>No sales yet</p>
        <span>Daily ticket sales will chart here once you record the first one.</span>
      </div>
    );
  }
  const max = niceMax(Math.max(...points.map((p) => p.tickets)));
  const ticks = [max, (max * 3) / 4, max / 2, max / 4, 0];
  const labelEvery = Math.ceil(points.length / 7);

  return (
    <figure className="ad-chart">
      <div className="ad-chart-y" aria-hidden>
        {ticks.map((t) => (
          <span key={t}>{Number.isInteger(t) ? t : ""}</span>
        ))}
      </div>
      <div className="ad-chart-area">
        <div className="ad-chart-grid" aria-hidden>
          {ticks.map((t) => (
            <span key={t} />
          ))}
        </div>
        <div className="ad-chart-bars">
          {points.map((p) => (
            <div
              key={p.day}
              className="ad-chart-col"
              style={{ "--h": `${(p.tickets / max) * 100}%` } as React.CSSProperties}
              tabIndex={0}
              aria-label={`${formatDay(p.day)}: ${p.tickets} ticket${p.tickets === 1 ? "" : "s"}, ${formatNaira(p.revenue)}`}
            >
              {p.tickets > 0 && <span className="ad-chart-bar" style={{ height: `${(p.tickets / max) * 100}%` }} />}
              <span className="ad-chart-tip" role="tooltip">
                <small>{formatDay(p.day)}</small>
                <b>
                  {p.tickets} ticket{p.tickets === 1 ? "" : "s"}
                </b>
                <span>{p.revenue ? formatNaira(p.revenue) : "₦0"}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="ad-chart-x" aria-hidden>
          {points.map((p, i) => (
            <span key={p.day}>{i % labelEvery === 0 || i === points.length - 1 ? formatDay(p.day) : ""}</span>
          ))}
        </div>
      </div>
    </figure>
  );
}
