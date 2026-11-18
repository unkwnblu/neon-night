import "server-only";

// Resend (https://resend.com/docs). Needs RESEND_API_KEY and EMAIL_FROM, an address on a domain
// verified in Resend, e.g. "Neon Night <tickets@brickcityevent.site>".

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export type Attachment = { filename: string; content: string; content_type: string; content_id?: string };

export async function sendEmail(msg: {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Resend drops a repeat with the same key (kept 24h), as a second guard against double sends. */
  idempotencyKey: string;
  attachments?: Attachment[];
}) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": msg.idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [msg.to],
      reply_to: process.env.EMAIL_REPLY_TO || undefined,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as { id: string };
}
