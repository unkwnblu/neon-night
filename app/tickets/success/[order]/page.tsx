import Link from "next/link";
import { Suspense } from "react";
import { EVENT, eventWhen } from "@/lib/event";
import { supabase } from "@/lib/supabase";
import { formatNaira } from "@/lib/ticket-types";
import { AutoRefresh } from "./AutoRefresh";

// Bachs sends buyers back to /tickets/success/<our order id>. (It also appends ?checkout_id=, but that's
// its hosted page's short code, not the chk_ id used by its API and webhooks, so we don't rely on it.)
export default function OrderResultPage({ params }: { params: Promise<{ order: string }> }) {
  return (
    <main className="tk-main tk-result">
      <Suspense fallback={<p className="tk-note">Checking your payment…</p>}>
        <OrderStatus params={params} />
      </Suspense>
      <Link href="/" className="tk-back">
        ← Back to Neon Night
      </Link>
    </main>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "jane@example.com" -> "j***@example.com", so a shared link doesn't expose the full address. */
const maskEmail = (email: string) => email.replace(/^(.)[^@]*/, "$1***");

async function OrderStatus({ params }: { params: Promise<{ order: string }> }) {
  const { order } = await params;
  if (!UUID.test(order)) return <Missing />;

  const { data: sale } = await supabase()
    .from("ticket_sales")
    .select("buyer_name, buyer_email, quantity, total_naira, status, ticket_tiers(name)")
    .eq("id", order)
    .eq("source", "online")
    .maybeSingle<{
      buyer_name: string;
      buyer_email: string;
      quantity: number;
      total_naira: number;
      status: string;
      ticket_tiers: { name: string } | null;
    }>();
  if (!sale) return <Missing />;

  const what = `${sale.quantity} × ${sale.ticket_tiers?.name ?? "ticket"} · ${formatNaira(sale.total_naira)}`;
  const first = sale.buyer_name.split(/\s+/)[0];

  if (sale.status === "paid") {
    return (
      <section className="tk-card">
        <p className="tk-kicker">Payment received</p>
        <h1>You&apos;re in, {first}!</h1>
        <p className="tk-what">{what}</p>
        <p className="tk-note">
          We&apos;ve emailed your receipt and your tickets (with QR codes for the door) to{" "}
          <b>{maskEmail(sale.buyer_email)}</b>.
        </p>
        <SpamTip />
        <EventDetails />
      </section>
    );
  }
  if (sale.status === "pending") {
    return (
      <section className="tk-card">
        <p className="tk-kicker">Almost there</p>
        <h1>Confirming your payment…</h1>
        <p className="tk-what">{what}</p>
        <p className="tk-note">
          This usually takes a few seconds; bank transfers can take a few minutes. You can keep this page open,
          we&apos;ll update it, and your receipt and tickets will go to <b>{maskEmail(sale.buyer_email)}</b>.
        </p>
        <SpamTip />
        <AutoRefresh />
      </section>
    );
  }
  return (
    <section className="tk-card">
      <p className="tk-kicker">Not completed</p>
      <h1>This checkout {sale.status === "refunded" ? "was refunded" : "expired"}</h1>
      <p className="tk-note">
        If you paid and money left your account, email us with your name and {maskEmail(sale.buyer_email)}. Otherwise you can{" "}
        <Link href="/tickets">start again</Link>.
      </p>
    </section>
  );
}

function Missing() {
  return (
    <section className="tk-card">
      <h1>We couldn&apos;t find that order</h1>
      <p className="tk-note">
        If you&apos;ve paid, your receipt email is your proof of purchase. Or <Link href="/tickets">get tickets</Link>.
      </p>
    </section>
  );
}

function SpamTip() {
  // "Neon Night <tickets@brickcityevent.site>" -> "tickets@brickcityevent.site"
  const from = process.env.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? process.env.EMAIL_FROM;
  return (
    <p className="tk-tip">
      <b>Don&apos;t see our emails?</b> {from ? <>They come from {from}. </> : null}Give it a few minutes, then check
      your <b>spam</b>, junk or promotions folder, and mark us as &ldquo;not spam&rdquo; so your tickets land in your inbox.
    </p>
  );
}

function EventDetails() {
  const when = eventWhen();
  if (!when && !EVENT.venue) return null;
  return (
    <p className="tk-note">
      See you {when ? <b>{when}</b> : "soon"}
      {EVENT.venue && (
        <>
          {" "}
          at <b>{EVENT.venue}</b>
        </>
      )}
      .
    </p>
  );
}
