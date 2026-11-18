import Link from "next/link";
import { isBachsConfigured } from "@/lib/bachs";
import { EVENT } from "@/lib/event";
import { getPublicTiers } from "@/lib/tickets";
import { TicketCheckout } from "./TicketCheckout";

export default async function TicketsPage() {
  const tiers = await getPublicTiers();
  return (
    <main className="tk-main">
      <Link href="/" className="tk-back">
        ← {EVENT.name}
      </Link>
      <header className="tk-head">
        <p className="tk-kicker">
          {EVENT.series} · {EVENT.host}
        </p>
        <h1>Get tickets</h1>
      </header>
      {tiers.length === 0 ? (
        <p className="tk-note">Tickets aren&apos;t on sale yet. Check back soon.</p>
      ) : (
        <TicketCheckout tiers={tiers} paymentsOpen={isBachsConfigured()} />
      )}
    </main>
  );
}
