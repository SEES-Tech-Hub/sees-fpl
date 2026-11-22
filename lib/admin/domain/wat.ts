// Converting the WAT dates and times admins type (CSV files, forms) to UTC
// instants. Times are stored as timestamptz and computed in UTC; WAT is only
// for input and display.

export const LAGOS_TIME_ZONE = "Africa/Lagos";

export type WatParseResult = { ok: true; date: Date } | { ok: false; message: string };

const partsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: LAGOS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function lagosParts(instant: Date) {
  const parts: Record<string, string> = {};
  for (const part of partsFormat.formatToParts(instant)) parts[part.type] = part.value;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Parses "YYYY-MM-DD" into numbers, checking it's a real calendar date. */
export function parseIsoDate(text: string): { year: number; month: number; day: number } | null {
  const match = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** Parses "HH:MM" (24-hour; "9:30" is accepted). */
export function parseTime(text: string): { hour: number; minute: number } | null {
  const match = text.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * The UTC instant for a wall-clock date and time in Lagos. Uses the time-zone
 * database rather than a fixed +1, so it stays right if WAT ever changes.
 */
export function watToUtc(dateText: string, timeText: string): WatParseResult {
  const date = parseIsoDate(dateText);
  if (!date) return { ok: false, message: `"${dateText.trim()}" isn't a date. Use YYYY-MM-DD, like 2026-11-28` };
  const time = parseTime(timeText);
  if (!time) return { ok: false, message: `"${timeText.trim()}" isn't a time. Use 24-hour HH:MM, like 16:00` };

  const wallAsUtc = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute);
  // First guess: treat the wall time as UTC, then correct by Lagos's offset at
  // that instant. Two passes settle any offset change between guesses.
  let instant = wallAsUtc;
  for (let i = 0; i < 2; i += 1) {
    const p = lagosParts(new Date(instant));
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    instant += wallAsUtc - shownAsUtc;
  }
  return { ok: true, date: new Date(instant) };
}

/** The Lagos date ("2026-11-28") and time ("16:00") of an instant, for CSV export. */
export function utcToWat(instant: Date | string): { date: string; time: string } {
  const p = lagosParts(new Date(instant));
  const pad = (n: number) => String(n).padStart(2, "0");
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/** Start (inclusive) and end (exclusive) of the Lagos calendar day containing `now`. */
export function watDayBounds(now: Date): { start: Date; end: Date } {
  const { date } = utcToWat(now);
  const start = watToUtc(date, "00:00");
  if (!start.ok) throw new Error("watDayBounds: unreachable");
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextDate = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  const end = watToUtc(nextDate, "00:00");
  if (!end.ok) throw new Error("watDayBounds: unreachable");
  return { start: start.date, end: end.date };
}
