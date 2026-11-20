// Cell parsers shared by the CSV importers. Each returns a plain-words problem
// ("isn't a year; use 1 to 5") that the caller prefixes with the row and column.

import { PLAYER_STATUSES, type PlayerPosition, type PlayerStatus } from "../types";

export type CellResult<T> = { ok: true; value: T } | { ok: false; message: string };

export function parseYear(raw: string): CellResult<number> {
  const text = raw.trim().replace(/^year\s*/i, "").replace(/^y/i, "");
  if (raw.trim() === "") return { ok: false, message: "is missing" };
  if (!/^[1-5]$/.test(text)) return { ok: false, message: `"${raw.trim()}" isn't a year; use 1 to 5` };
  return { ok: true, value: Number(text) };
}

const POSITION_WORDS: Record<string, PlayerPosition> = {
  gk: "GK",
  goalkeeper: "GK",
  keeper: "GK",
  def: "DEF",
  defender: "DEF",
  mid: "MID",
  midfielder: "MID",
  fwd: "FWD",
  forward: "FWD",
  att: "FWD",
  attacker: "FWD",
  striker: "FWD",
};

export function parsePosition(raw: string): CellResult<PlayerPosition> {
  const text = raw.trim();
  if (text === "") return { ok: false, message: "is missing" };
  const position = POSITION_WORDS[text.toLowerCase()];
  if (!position) return { ok: false, message: `"${text}" isn't a position; use GK, DEF, MID or FWD` };
  return { ok: true, value: position };
}

/** Empty means "no shirt number" (new players) or "leave it as it is" (existing players). */
export function parseShirtNumber(raw: string): CellResult<number | null> {
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };
  if (!/^\d{1,2}$/.test(text)) return { ok: false, message: `"${text}" isn't a shirt number; use 0 to 99` };
  return { ok: true, value: Number(text) };
}

/** Empty means "available" (new players) or "leave it as it is" (existing players). */
export function parseStatus(raw: string): CellResult<PlayerStatus | null> {
  const text = raw.trim().toLowerCase();
  if (text === "") return { ok: true, value: null };
  const status = PLAYER_STATUSES.find((s) => s === text);
  if (!status) return { ok: false, message: `"${raw.trim()}" isn't a status; use ${PLAYER_STATUSES.join(", ")}` };
  return { ok: true, value: status };
}
