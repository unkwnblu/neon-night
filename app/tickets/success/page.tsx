import Link from "next/link";

/** Old-style return link without an order id: nothing to look up. */
export default function SuccessFallbackPage() {
  return (
    <main className="tk-main tk-result">
      <section className="tk-card">
        <p className="tk-kicker">Thanks</p>
        <h1>Payment submitted</h1>
        <p className="tk-note">
          If your payment went through, Bachs emails you a receipt; that email is your proof of purchase. Or{" "}
          <Link href="/tickets">get tickets</Link>.
        </p>
      </section>
      <Link href="/" className="tk-back">
        ← Back to Neon Night
      </Link>
    </main>
  );
}
