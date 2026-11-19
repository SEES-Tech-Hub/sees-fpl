// TODO(Henry): swap for Fortune's shared formatWAT once the day-1 design kit
// lands. Every fantasy screen formats times through this file only, so the
// swap is a one-file change.

const TZ = "Africa/Lagos";

const formatters = {
  // Sat 28 Nov, 13:30
  dateTime: new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
  // Sat 28 Nov
  date: new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  }),
  // 13:30
  time: new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
} as const;

export type WatStyle = keyof typeof formatters;

/** Formats a time in WAT (Africa/Lagos). Returns "TBC" for a missing time. */
export function formatWAT(value: string | Date | null | undefined, style: WatStyle = "dateTime") {
  if (!value) return "TBC";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "TBC";
  return formatters[style].format(date).replace(",", "");
}

/** "2d 4h", "3h 12m", "4m 09s": a short countdown from milliseconds. */
export function formatCountdown(ms: number) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}
