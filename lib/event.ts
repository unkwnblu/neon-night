// Everything about the event that is likely to change lives here.
// Fields left as null are hidden on the page until they are filled in.
export const EVENT = {
  name: "Neon Night",
  series: "Brick City Rave",
  host: "Bells University Students' Association",
  /** Event day in Lagos, "YYYY-MM-DD". */
  date: "2026-12-12" as string | null,
  /** Doors / start time in Lagos, 24-hour "HH:MM" (e.g. "20:00"), or null until announced. */
  startTime: "17:00" as string | null,
  venue: "Professor Jeremiah O. Ojediran Hall ( Marquee )" as string | null,
  /** When tickets go on sale (Lagos time). Shows a countdown on the last screen until then. */
  ticketsDrop: "2026-11-18T12:00:00+01:00" as string | null,
  ticketsUrl: null as string | null,
  instagramUrl: null as string | null,
};

/**
 * Lineup slots. Each one shows as a "?" square until it is filled in.
 * To reveal an artist, set `name` and put their photo in /public (e.g.
 * "/artists/name.jpg"), then set `image` to that path. A square photo works best.
 */
export type Artist = { name: string | null; image: string | null };

export const ARTISTS: Artist[] = [
  { name: null, image: null },
  { name: null, image: null },
  { name: null, image: null },
  { name: null, image: null },
  { name: null, image: null },
];

/**
 * The two DJs shown as cards on the dance-floor stop. They work the same way
 * as the lineup slots: a "?" card until `name` and `image` are filled in.
 * A portrait photo (taller than wide) fits the card best.
 */
export const DJS: Artist[] = [
  { name: "DJ Remix", image: "/djs/dj-remix.jpg" },
  { name: "DJ Gecho", image: "/djs/dj-gecho.jpg" },
];

/** hero, intro, one per artist, the floor, landing */
export const BEAT_COUNT = ARTISTS.length + 4;

/** When the night starts, as an ISO time (midnight Lagos time until a start time is set). */
export function eventStartIso() {
  return EVENT.date ? `${EVENT.date}T${EVENT.startTime ?? "00:00"}:00+01:00` : null;
}

/** "Saturday, 12 December 2026" (plus ", 8 pm" once a start time is set), or null. */
export function eventWhen(style: "long" | "short" = "long") {
  if (!EVENT.date) return null;
  const day = new Intl.DateTimeFormat("en-NG", {
    weekday: style,
    day: "numeric",
    month: style,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${EVENT.date}T00:00:00Z`));
  if (!EVENT.startTime) return day;
  const [h, m] = EVENT.startTime.split(":").map(Number);
  return `${day}, ${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "am" : "pm"}`;
}
