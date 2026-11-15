// Everything about the event that is likely to change lives here.
// Fields left as null are hidden on the page until they are filled in.
export const EVENT = {
  name: "Neon Night",
  series: "Brick City Rave",
  host: "Bells University Students' Association",
  /** ISO date-time, e.g. "2026-12-05T20:00:00+01:00". Shows the countdown when set. */
  date: null as string | null,
  venue: null as string | null,
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
  { name: null, image: null },
];

/** hero, intro, one per artist, the floor, landing */
export const BEAT_COUNT = ARTISTS.length + 4;
