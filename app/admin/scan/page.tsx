import { Suspense } from "react";
import { requireDoor } from "@/lib/admin-auth";
import { checkInStats } from "@/lib/checkin";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Scanner } from "./Scanner";

export const metadata = { title: "Check-in | Neon Night" };

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="sc-shell sc-loading">Loading scanner…</div>}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  const role = await requireDoor();
  if (!isSupabaseConfigured()) return <div className="sc-shell sc-loading">The ticket database isn&apos;t configured.</div>;
  const stats = await checkInStats();
  return <Scanner role={role} initialStats={stats} />;
}
