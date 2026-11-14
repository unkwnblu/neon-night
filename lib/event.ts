// Everything about the event that is likely to change lives here.
// Fields left as null are hidden on the page until they are filled in.
export const EVENT = {
  name: "Neon Night",
  series: "Brick City Rave",
  host: "Bells University Students' Association",
  /** ISO date-time, e.g. "2026-12-05T20:00:00+01:00". Shows the countdown when set. */
  date: null as string | null,
  venue: null as string | null,
  ticketsUrl: null as string | null,
  instagramUrl: null as string | null,
};

export const GENRES = [
  { name: "Hip Hop", line: "Bars heavy enough to shake the bricks." },
  { name: "Rave", line: "Lasers up. Lights down. No brakes." },
  { name: "R&B", line: "Slow it down and keep it glowing." },
  { name: "Afrobeat", line: "The sound of home, turned all the way up." },
] as const;

/** hero, intro, one per genre, the floor, landing */
export const BEAT_COUNT = GENRES.length + 4;
