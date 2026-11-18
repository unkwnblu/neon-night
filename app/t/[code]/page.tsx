import Link from "next/link";
import QRCode from "qrcode";
import { Suspense } from "react";
import { EVENT, eventWhen } from "@/lib/event";
import { supabase } from "@/lib/supabase";
import { formatLagos } from "@/lib/ticket-types";

// A ticket's own page, linked from the tickets email: the QR code to show at the door.
// The code is random and unguessable, so knowing it is what grants access to this page.

export default function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <main className="tk-main tk-result">
      <Suspense fallback={<p className="tk-note">Loading your ticket…</p>}>
        <Ticket params={params} />
      </Suspense>
      <Link href="/" className="tk-back">
        ← {EVENT.name}
      </Link>
    </main>
  );
}

async function Ticket({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (!/^NN-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return <NotFound />;

  const { data: t } = await supabase()
    .from("tickets")
    .select("code, holder_number, void, checked_in_at, ticket_tiers(name, description), ticket_sales(buyer_name, quantity, status)")
    .eq("code", code)
    .maybeSingle<{
      code: string;
      holder_number: number;
      void: boolean;
      checked_in_at: string | null;
      ticket_tiers: { name: string; description: string | null } | null;
      ticket_sales: { buyer_name: string; quantity: number; status: string } | null;
    }>();
  if (!t) return <NotFound />;

  const voided = t.void || t.ticket_sales?.status === "refunded";
  const svg = await QRCode.toString(t.code, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  const when = eventWhen() ?? "Date to be announced";
  const where = EVENT.venue ?? "Venue to be announced";

  return (
    <section className={`tk-card tk-ticket ${voided ? "is-void" : ""}`}>
      <p className="tk-kicker">
        {voided ? "Not valid" : t.checked_in_at ? "Already used" : "Admit one"} · Ticket {t.holder_number} of{" "}
        {t.ticket_sales?.quantity ?? 1}
      </p>
      <h1>{t.ticket_tiers?.name ?? "Ticket"}</h1>
      {t.ticket_tiers?.description && <p className="tk-what">{t.ticket_tiers.description}</p>}
      {/* QRCode generates this SVG from the ticket code only, so it's safe to inline. */}
      <div className="tk-qr" role="img" aria-label={`QR code for ticket ${t.code}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="tk-code">{t.code}</p>
      <p className="tk-note">
        {voided ? (
          <>This ticket was refunded and won&apos;t get you in.</>
        ) : t.checked_in_at ? (
          <>Scanned at the door {formatLagos(t.checked_in_at)}.</>
        ) : (
          <>
            {t.ticket_sales?.buyer_name}
            <br />
            {when} · {where}
          </>
        )}
      </p>
    </section>
  );
}

function NotFound() {
  return (
    <section className="tk-card">
      <h1>Ticket not found</h1>
      <p className="tk-note">
        Check the link in your tickets email, or reply to that email and we&apos;ll help.
      </p>
    </section>
  );
}
