// The festival's calendar, in WAT: which day of it today is. Pure functions,
// safe on server and client.

const watDay = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));

const dayNumber = (key: string) => Math.round(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / 86_400_000);

export type FestivalDay =
  | { phase: "before"; days: number }
  | { phase: "during"; day: number; days: number }
  | { phase: "after"; days: number };

/** Where `now` falls between the first and last match days (inclusive, WAT). */
export function festivalDay(now: number, firstAt: string, lastAt: string): FestivalDay {
  const first = dayNumber(watDay(new Date(firstAt).getTime()));
  const last = dayNumber(watDay(new Date(lastAt).getTime()));
  const today = dayNumber(watDay(now));
  const days = last - first + 1;
  if (today < first) return { phase: "before", days };
  if (today > last) return { phase: "after", days };
  return { phase: "during", day: today - first + 1, days };
}
