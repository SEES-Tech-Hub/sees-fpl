// TODO(Henry): swap for Fortune's shared formatWAT once the day-1 design kit
// lands. Every fantasy screen formats times through this file only, so the
// swap is a one-file change. Formats follow the design system §5:
// times "4:00 pm", dates "Sat 28 Nov".

const TZ = "Africa/Lagos";

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });

export type WatStyle = "dateTime" | "date" | "time";

function parse(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "4:00 pm" */
function time(date: Date) {
  // ICU may put a narrow no-break space before AM/PM; normalise to "4:00 pm".
  return timeFmt.format(date).replace(/[\s\u202f]*(AM|PM)$/i, (_, p: string) => ` ${p.toLowerCase()}`);
}

/** "Sat 28 Nov" */
function date(date: Date) {
  return dateFmt.format(date).replace(",", "");
}

/** Formats a time in WAT. "Sat 28 Nov, 4:00 pm", "Sat 28 Nov" or "4:00 pm". "TBC" if missing. */
export function formatWAT(value: string | Date | null | undefined, style: WatStyle = "dateTime") {
  const d = parse(value);
  if (!d) return "TBC";
  if (style === "date") return date(d);
  if (style === "time") return time(d);
  return `${date(d)}, ${time(d)}`;
}

/** Design system §11.1 Countdown: "2d 4h", then "3h 12m", then "12:45" in the last hour. */
export function formatCountdown(ms: number) {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
