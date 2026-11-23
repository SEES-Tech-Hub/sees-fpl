import type { FantasyError, FantasyErrorCode } from "./types";

// Fallback copy for each backend error code. The backend's own message wins
// when it sends one (see docs/fantasy-backend-contract.md §3.8).
export const ERROR_COPY: Record<FantasyErrorCode, string> = {
  NOT_SIGNED_IN: "Sign in to play SEES Fantasy.",
  NO_MANAGER: "Create your fantasy team first.",
  MANAGER_EXISTS: "You already have a fantasy team.",
  TEAM_NAME_INVALID: "Choose a different team name.",
  YEAR_GROUP_INVALID: "Pick your year.",
  NO_OPEN_MATCHDAY: "There's no matchday open for changes right now.",
  DEADLINE_PASSED: "The deadline has passed. Your team is locked.",
  SQUAD_EXISTS: "You already have a squad. Use Transfers to change it.",
  NO_SQUAD: "Pick your squad first.",
  SQUAD_SIZE: "Pick exactly 15 players.",
  SQUAD_POSITIONS: "Your squad needs 2 GK, 5 DEF, 5 MID and 3 FWD.",
  OVER_BUDGET: "Your squad is over budget.",
  TEAM_LIMIT: "Too many players from one year.",
  PLAYER_UNKNOWN: "One of those players no longer exists. Refresh and try again.",
  PLAYER_UNAVAILABLE: "One of those players has left their squad. Pick someone else.",
  PLAYER_DUPLICATE: "A player is in your squad twice.",
  LINEUP_NOT_IN_SQUAD: "Your lineup doesn't match your squad. Refresh and try again.",
  FORMATION_INVALID: "That formation isn't allowed.",
  BENCH_GK_INVALID: "The first bench place must be a goalkeeper.",
  CAPTAIN_INVALID: "Pick a captain and a different vice-captain from your starting XI.",
  TRANSFER_INVALID: "Those transfers don't fit your squad. Refresh and try again.",
  TRANSFER_POSITION: "A player can only be replaced by one in the same position.",
  WILDCARD_USED: "You've already played your Wildcard.",
  WILDCARD_NOT_ALLOWED: "You can't play the Wildcard this matchday.",
  LEAGUE_NAME_INVALID: "League names need 3 to 30 characters.",
  LEAGUE_CODE_INVALID: "League codes are 6 letters and numbers.",
  LEAGUE_NOT_FOUND: "No league has that code.",
  LEAGUE_ALREADY_MEMBER: "You're already in that league.",
  UNKNOWN: "Something went wrong. Try again.",
};

export function fantasyError(code: FantasyErrorCode, message?: string, playerIds?: string[]): FantasyError {
  return { code, message: message || ERROR_COPY[code], ...(playerIds ? { playerIds } : {}) };
}

/** Turns an RPC failure ("CODE: message") into a FantasyError. */
export function parseRpcError(raw: string | undefined | null): FantasyError {
  const text = raw ?? "";
  const match = /^([A-Z_]+):\s*([\s\S]*)$/.exec(text);
  if (match && match[1] in ERROR_COPY) {
    return fantasyError(match[1] as FantasyErrorCode, match[2]);
  }
  return fantasyError("UNKNOWN");
}
