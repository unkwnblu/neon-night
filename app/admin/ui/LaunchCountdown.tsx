"use client";

import { useEffect, useState } from "react";

/** "1d 4h 12m 30s" until `to`, ticking each second; null once it has passed. */
export function LaunchCountdown({ to, live }: { to: string; live: React.ReactNode }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (now === null) return <span className="ad-countdown">––</span>;
  const left = Date.parse(to) - now;
  if (left <= 0) return <>{live}</>;
  const s = Math.floor(left / 1000);
  const parts: [number, string][] = [
    [Math.floor(s / 86400), "d"],
    [Math.floor(s / 3600) % 24, "h"],
    [Math.floor(s / 60) % 60, "m"],
    [s % 60, "s"],
  ];
  return (
    <span className="ad-countdown" role="timer">
      {parts.map(([v, unit]) => (
        <span key={unit}>
          {String(v).padStart(2, "0")}
          <small>{unit}</small>
        </span>
      ))}
    </span>
  );
}
