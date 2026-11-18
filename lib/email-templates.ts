import "server-only";
import { EVENT, eventWhen } from "./event";
import { formatLagos, formatNaira, PAYMENT_METHODS, type PaymentMethod } from "./ticket-types";

// Email HTML has to survive Gmail, Outlook and Apple Mail: tables, inline styles, web-safe fonts.

export type OrderForEmail = {
  id: string;
  buyerName: string;
  buyerEmail: string;
  tierName: string;
  tierDescription: string | null;
  quantity: number;
  unitPriceNaira: number;
  totalNaira: number;
  paymentMethod: PaymentMethod;
  checkoutId: string | null;
  paidAt: string;
};

export type TicketForEmail = { code: string; holderNumber: number; qrCid: string; url: string };

const C = {
  bg: "#050805",
  card: "#0c120c",
  border: "#1c2b1c",
  text: "#eef6ea",
  muted: "#93a58e",
  neon: "#39ff14",
};
const FONT = "font-family:Helvetica,Arial,sans-serif;";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const orderNumber = (id: string) => id.slice(0, 8).toUpperCase();
const firstName = (name: string) => name.split(/\s+/)[0];
const naira = (n: number) => (n === 0 ? "₦0" : formatNaira(n));

function whenWhere() {
  const when = eventWhen() ?? "Date to be announced";
  const where = EVENT.venue ?? "Venue to be announced";
  return { when, where, tba: !EVENT.date || !EVENT.venue };
}

function shell(preheader: string, body: string) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(EVENT.name)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="${FONT}padding:0 4px 18px;">
  <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.neon};font-weight:bold;">${esc(EVENT.series)}</div>
  <div style="font-size:30px;line-height:1.1;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:${C.text};">${esc(EVENT.name)}</div>
</td></tr>
${body}
<tr><td style="${FONT}padding:22px 4px 0;font-size:12px;line-height:1.6;color:${C.muted};">
  ${esc(EVENT.host)}<br>Questions? Just reply to this email.
</td></tr>
</table></td></tr></table></body></html>`;
}

function card(inner: string) {
  return `<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:24px;${FONT}color:${C.text};">${inner}</td></tr>
<tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>`;
}

function row(label: string, value: string, strong = false) {
  return `<tr>
  <td style="${FONT}padding:7px 0;font-size:14px;color:${C.muted};">${label}</td>
  <td align="right" style="${FONT}padding:7px 0;font-size:${strong ? 18 : 14}px;color:${C.text};${strong ? "font-weight:bold;" : ""}">${value}</td>
</tr>`;
}

// ---------- Receipt ----------

export function receiptEmail(o: OrderForEmail) {
  const { when, where } = whenWhere();
  const paidWith = o.paymentMethod === "online" ? "Online payment (Bachs)" : PAYMENT_METHODS[o.paymentMethod];
  const subject = `Your receipt for ${EVENT.name} · ${naira(o.totalNaira)}`;

  const html = shell(
    `Payment received: ${o.quantity} × ${o.tierName}, ${naira(o.totalNaira)}.`,
    card(`
  <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.neon};font-weight:bold;">Payment received</div>
  <div style="font-size:24px;font-weight:bold;margin:6px 0 4px;">Thanks, ${esc(firstName(o.buyerName))}!</div>
  <div style="font-size:14px;line-height:1.6;color:${C.muted};">This is your receipt. Your tickets are in a separate email with QR codes for the door.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid ${C.border};">
    ${row(`${o.quantity} × ${esc(o.tierName)}${o.tierDescription ? `<br><span style="color:${C.neon};font-size:12px;">${esc(o.tierDescription)}</span>` : ""}`, naira(o.unitPriceNaira * o.quantity))}
    <tr><td colspan="2" style="border-top:1px solid ${C.border};font-size:0;line-height:0;">&nbsp;</td></tr>
    ${row("Total paid", naira(o.totalNaira), true)}
  </table>`) +
      card(`
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${row("Order", `#${orderNumber(o.id)}`)}
    ${row("Paid", esc(formatLagos(o.paidAt)))}
    ${row("Paid with", esc(paidWith))}
    ${o.checkoutId ? row("Payment reference", `<span style="font-family:Menlo,Consolas,monospace;font-size:12px;">${esc(o.checkoutId)}</span>`) : ""}
    ${row("Name", esc(o.buyerName))}
    ${row("Event", `${esc(when)}<br>${esc(where)}`)}
  </table>`),
  );

  const text = [
    `${EVENT.name}: payment received`,
    ``,
    `Thanks, ${firstName(o.buyerName)}! This is your receipt. Your tickets come in a separate email.`,
    ``,
    `${o.quantity} x ${o.tierName}${o.tierDescription ? ` (${o.tierDescription})` : ""}: ${naira(o.unitPriceNaira * o.quantity)}`,
    `Total paid: ${naira(o.totalNaira)}`,
    ``,
    `Order: #${orderNumber(o.id)}`,
    `Paid: ${formatLagos(o.paidAt)}`,
    `Paid with: ${paidWith}`,
    o.checkoutId ? `Payment reference: ${o.checkoutId}` : null,
    `Event: ${when}, ${where}`,
    ``,
    EVENT.host,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { subject, html, text };
}

// ---------- Tickets ----------

export function ticketsEmail(o: OrderForEmail, tickets: TicketForEmail[]) {
  const { when, where, tba } = whenWhere();
  const many = tickets.length > 1;
  const subject = `Your ${many ? `${tickets.length} tickets` : "ticket"} for ${EVENT.name}`;

  const ticketCards = tickets
    .map(
      (t) => `
<tr><td style="background:${C.card};border:1px solid ${C.neon};border-radius:14px;padding:22px;${FONT}color:${C.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td valign="top" style="${FONT}">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.neon};font-weight:bold;">Ticket ${t.holderNumber} of ${tickets.length}</div>
      <div style="font-size:22px;font-weight:900;text-transform:uppercase;margin:6px 0 2px;">${esc(o.tierName)}</div>
      ${o.tierDescription ? `<div style="font-size:13px;color:${C.neon};margin-bottom:6px;">${esc(o.tierDescription)}</div>` : ""}
      <div style="font-size:13px;color:${C.muted};line-height:1.6;">${esc(o.buyerName)}<br>${esc(when)}<br>${esc(where)}</div>
      <div style="font-family:Menlo,Consolas,monospace;font-size:17px;letter-spacing:2px;font-weight:bold;margin-top:12px;color:${C.text};">${t.code}</div>
      <a href="${t.url}" style="display:inline-block;margin-top:12px;font-size:13px;color:${C.neon};">View ticket online</a>
    </td>
    <td valign="top" align="right" width="150" style="padding-left:12px;">
      <img src="cid:${t.qrCid}" width="140" height="140" alt="QR code for ticket ${t.code}" style="display:block;border-radius:8px;background:#ffffff;">
    </td>
  </tr></table>
</td></tr>
<tr><td style="height:14px;line-height:14px;font-size:0;">&nbsp;</td></tr>`,
    )
    .join("");

  const html = shell(
    `${many ? `Your ${tickets.length} tickets are` : "Your ticket is"} here. Show the QR code at the door.`,
    card(`
  <div style="font-size:24px;font-weight:bold;margin-bottom:6px;">You're in, ${esc(firstName(o.buyerName))}!</div>
  <div style="font-size:14px;line-height:1.6;color:${C.muted};">
    Show ${many ? "each QR code" : "the QR code"} below at the door, from this email or a screenshot.
    ${many ? "Forward or screenshot a ticket for each person in your group; each code works once." : "It works once, so keep it to yourself."}
    ${tba ? `<br><br>The date and venue will be announced soon; we'll email you.` : ""}
  </div>`) + ticketCards,
  );

  const text = [
    `${EVENT.name}: your ${many ? "tickets" : "ticket"}`,
    ``,
    `You're in, ${firstName(o.buyerName)}! Show the QR code at the door (open each link below to see it).`,
    ``,
    ...tickets.map((t) => `Ticket ${t.holderNumber}: ${o.tierName}, code ${t.code}, ${t.url}`),
    ``,
    `${when}, ${where}`,
    ``,
    EVENT.host,
  ].join("\n");

  return { subject, html, text };
}
