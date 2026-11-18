// Ticket tier shapes and form validation. No server-only imports, so the
// public page (a client component) can use the types too.

export type TicketTier = {
  id: string;
  name: string;
  description: string | null;
  priceNaira: number;
  quantity: number;
  /** ISO date-time */
  salesStart: string;
  /** ISO date-time, or null for "until sold out / the event" */
  salesEnd: string | null;
  sortOrder: number;
  hidden: boolean;
};

/** What the public page gets: hidden tiers are never sent, and only how many are left, not sales. */
export type PublicTier = Omit<TicketTier, "hidden" | "sortOrder"> & { remaining: number };

export type TierStatus = "upcoming" | "on-sale" | "ended";

export function tierStatus(tier: Pick<TicketTier, "salesStart" | "salesEnd">, now: number): TierStatus {
  if (now < Date.parse(tier.salesStart)) return "upcoming";
  if (tier.salesEnd && now >= Date.parse(tier.salesEnd)) return "ended";
  return "on-sale";
}

/** Nigeria has no daylight saving, so Lagos time is always UTC+1. */
export const LAGOS_OFFSET = "+01:00";

/** "2026-11-18T12:00" typed in Lagos time -> ISO string. */
export function lagosLocalToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const ms = Date.parse(`${local}:00${LAGOS_OFFSET}`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** ISO string -> "2026-11-18T12:00" in Lagos time, for <input type="datetime-local">. */
export function isoToLagosLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(Date.parse(iso) + 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function formatNaira(amount: number) {
  return amount === 0 ? "Free" : `₦${amount.toLocaleString("en-NG")}`;
}

/** "Wed, 18 Nov, 12 pm", always in Lagos time. */
export function formatLagos(iso: string) {
  return new Intl.DateTimeFormat("en-NG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  })
    .format(new Date(iso))
    .replace(":00", "");
}

export type TierInput = Omit<TicketTier, "id">;
export type FieldErrors = Partial<Record<keyof TierInput | "form", string>>;

function wholeNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").replace(/[,\s₦]/g, "");
  return /^\d+$/.test(text) ? Number(text) : NaN;
}

export function parseTierForm(form: FormData): { input: TierInput; errors: null } | { input: null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const priceNaira = wholeNumber(form.get("price"));
  const quantity = wholeNumber(form.get("quantity"));
  const salesStart = lagosLocalToIso(String(form.get("salesStart") ?? ""));
  const endText = String(form.get("salesEnd") ?? "");
  const salesEnd = endText ? lagosLocalToIso(endText) : null;
  const sortOrder = wholeNumber(form.get("sortOrder") || "0");

  if (!name) errors.name = "Give the tier a name, e.g. Early Bird.";
  else if (name.length > 60) errors.name = "Keep the name under 60 characters.";
  if (description.length > 200) errors.description = "Keep the description under 200 characters.";
  if (Number.isNaN(priceNaira)) errors.priceNaira = "Enter the price in naira as a whole number, e.g. 5000.";
  else if (priceNaira > 10_000_000) errors.priceNaira = "That price looks too high.";
  if (Number.isNaN(quantity) || quantity < 1) errors.quantity = "Enter how many tickets are available (at least 1).";
  if (!salesStart) errors.salesStart = "Pick the date and time this tier goes on sale.";
  if (endText && !salesEnd) errors.salesEnd = "That end time isn't valid.";
  else if (salesStart && salesEnd && Date.parse(salesEnd) <= Date.parse(salesStart))
    errors.salesEnd = "Sales must end after they start.";

  if (Object.keys(errors).length) return { input: null, errors };
  return {
    input: {
      name,
      description: description || null,
      priceNaira,
      quantity,
      salesStart: salesStart!,
      salesEnd,
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      hidden: form.get("hidden") === "on",
    },
    errors: null,
  };
}

// ---------- Sales ----------

export const PAYMENT_METHODS = {
  cash: "Cash",
  transfer: "Bank transfer",
  pos: "POS",
  other: "Other",
  online: "Online (Bachs)",
} as const;
/** Methods an admin can pick when recording a sale by hand. */
export const MANUAL_METHODS = ["transfer", "cash", "pos", "other"] as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;

export type Sale = {
  id: string;
  tierId: string;
  tierName: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  unitPriceNaira: number;
  totalNaira: number;
  paymentMethod: PaymentMethod;
  note: string | null;
  /** pending: online order holding tickets while the buyer pays. expired: hold lapsed unpaid. */
  status: "pending" | "paid" | "expired" | "refunded";
  source: "manual" | "online";
  /** Paid after its tier was already full (a late online payment); needs an admin to sort out. */
  oversold: boolean;
  /** ISO date-time */
  createdAt: string;
  /** Tickets email delivered to Resend. */
  emailed: boolean;
  /** Last email failure, if the latest attempt failed. */
  emailError: string | null;
};

export type SaleInput = {
  tierId: string;
  buyerName: string;
  buyerEmail: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  note: string;
};
export type SaleErrors = Partial<Record<keyof SaleInput | "form", string>>;

export function parseSaleForm(form: FormData): { input: SaleInput; errors: null } | { input: null; errors: SaleErrors } {
  const errors: SaleErrors = {};
  const tierId = String(form.get("tierId") ?? "");
  const buyerName = String(form.get("buyerName") ?? "").trim();
  const buyerEmail = String(form.get("buyerEmail") ?? "").trim().toLowerCase();
  const quantity = wholeNumber(form.get("quantity"));
  const paymentMethod = String(form.get("paymentMethod") ?? "");
  const note = String(form.get("note") ?? "").trim();

  if (!tierId) errors.tierId = "Pick which ticket was sold.";
  if (!buyerName) errors.buyerName = "Enter the buyer's name.";
  else if (buyerName.length > 100) errors.buyerName = "Keep the name under 100 characters.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) errors.buyerEmail = "Enter a valid email address.";
  if (Number.isNaN(quantity) || quantity < 1) errors.quantity = "Enter how many tickets (at least 1).";
  else if (quantity > 50) errors.quantity = "Record at most 50 tickets per sale.";
  if (!(MANUAL_METHODS as readonly string[]).includes(paymentMethod)) errors.paymentMethod = "Pick how they paid.";
  if (note.length > 300) errors.note = "Keep the note under 300 characters.";

  if (Object.keys(errors).length) return { input: null, errors };
  return {
    input: { tierId, buyerName, buyerEmail, quantity, paymentMethod: paymentMethod as PaymentMethod, note },
    errors: null,
  };
}

/** "17 Nov" for a Lagos calendar day key "2026-11-17". */
export function formatDay(day: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** Lagos calendar day ("2026-11-17") for an ISO time. */
export function lagosDay(iso: string | number) {
  const ms = typeof iso === "number" ? iso : Date.parse(iso);
  return new Date(ms + 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ---------- Online checkout ---------- 

export const MAX_PER_ORDER = 10;

export type CheckoutInput = { tierId: string; quantity: number; buyerName: string; buyerEmail: string };
export type CheckoutErrors = Partial<Record<keyof CheckoutInput | "form", string>>;

export function parseCheckoutForm(form: FormData): { input: CheckoutInput; errors: null } | { input: null; errors: CheckoutErrors } {
  const errors: CheckoutErrors = {};
  const tierId = String(form.get("tierId") ?? "");
  const quantity = wholeNumber(form.get("quantity"));
  const buyerName = String(form.get("buyerName") ?? "").trim();
  const buyerEmail = String(form.get("buyerEmail") ?? "").trim().toLowerCase();
  if (!tierId) errors.tierId = "Pick a ticket.";
  if (Number.isNaN(quantity) || quantity < 1) errors.quantity = "Choose at least 1 ticket.";
  else if (quantity > MAX_PER_ORDER) errors.quantity = `You can buy up to ${MAX_PER_ORDER} tickets at once.`;
  if (!buyerName) errors.buyerName = "Enter your full name.";
  else if (buyerName.length > 100) errors.buyerName = "Keep your name under 100 characters.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) errors.buyerEmail = "Enter a valid email so we can send your ticket.";
  if (Object.keys(errors).length) return { input: null, errors };
  return { input: { tierId, quantity, buyerName, buyerEmail }, errors: null };
}
