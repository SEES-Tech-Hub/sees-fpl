import type { Position, Tenths } from "./types";

/** 55 → "₦5.5m". */
export function formatMoney(tenths: Tenths) {
  const sign = tenths < 0 ? "−" : "";
  return `${sign}₦${(Math.abs(tenths) / 10).toFixed(1)}m`;
}

/** 4 → "+4", -2 → "−2", 0 → "0". */
export function formatSigned(points: number) {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "0";
}

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};

export const POSITION_PLURAL: Record<Position, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
