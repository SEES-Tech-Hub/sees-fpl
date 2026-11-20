export { cn } from "cn"

// to ensure accurate time formatting regardless of zone
export function formatWAT(
  input: Date | string | number,
  mode: "time" | "date" | "datetime" = "time"
): string {
  const date = input instanceof Date ? input : new Date(input);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase(); // -> "4:00 pm"

  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(",", ""); // -> "Sat 28 Nov"

  if (mode === "time") return time;
  if (mode === "date") return day;
  return `${day} · ${time}`;
}
