// Admin-only time helpers, all in WAT (Africa/Lagos, UTC+1, no daylight
// saving). Replace with Fortune's formatWAT() from lib/time.ts once it lands.

const LAGOS = "Africa/Lagos";
const WAT_OFFSET_MS = 60 * 60 * 1000;

/** Start (inclusive) and end (exclusive) of the WAT calendar day containing `now`. */
export function watDayBounds(now: Date): { start: Date; end: Date } {
  const lagos = new Date(now.getTime() + WAT_OFFSET_MS);
  const startUtcMs =
    Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate()) - WAT_OFFSET_MS;
  return { start: new Date(startUtcMs), end: new Date(startUtcMs + 24 * 60 * 60 * 1000) };
}

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAGOS,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAGOS,
  weekday: "short",
  day: "numeric",
  month: "short",
});

const longDayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAGOS,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "4:00 pm" */
export const formatTime = (iso: string | Date) => timeFormat.format(new Date(iso));
/** "Sat 28 Nov" */
export const formatDay = (iso: string | Date) => dayFormat.format(new Date(iso));
/** "Thursday 19 November 2026" */
export const formatLongDay = (iso: string | Date) => longDayFormat.format(new Date(iso));
