// Display names for new players. Display names are unique within a team (the
// players table's unique (team_id, display_name)). Players in different teams
// may share one, because the year is always shown next to them.
//
// Existing players are never renamed: managers have already seen those names.
// Only new players get a disambiguated name, and each one is reported so the
// CSV preview can show it as a warning.
//
// How a new player's name is chosen, in order:
//   1. An explicit display name from the admin, used as it is (an error if taken).
//   2. The full name, if no other player in the team uses it and no other new
//      player in the same import has the same full name.
//   3. Otherwise the first candidate that is free:
//      a. first name + surname initial(s): "Samuel O.", then "Samuel Ok." —
//         only when the clash is with an existing player, since two new
//         players with the same full name share their surname letters too;
//      b. full name + position: "Samuel (DEF)" (as the seed did for Year 2);
//      c. full name + shirt number: "Samuel #7";
//      d. full name + a counter: "Samuel 2", "Samuel 3", ...

import type { PlayerPosition } from "../types";
import { nameKey, normaliseName } from "./names";

export type ExistingName = { teamId: string; displayName: string };

export type NewPlayerName = {
  /** Caller's key for the row, e.g. "Row 7". */
  key: string;
  teamId: string;
  fullName: string;
  position: PlayerPosition;
  shirtNumber: number | null;
  /** Display name typed by the admin, if any. */
  displayName: string | null;
};

export type DisplayNameResult =
  | { ok: true; displayName: string; disambiguated: boolean; reason: string | null }
  | { ok: false; message: string };

function* surnameCandidates(fullName: string): Generator<string> {
  const words = fullName.split(" ");
  if (words.length < 2) return;
  const first = words[0];
  const last = words[words.length - 1];
  for (let length = 1; length < last.length; length += 1) {
    yield `${first} ${last.slice(0, length)}.`;
  }
}

function* fallbackCandidates(fullName: string, position: PlayerPosition, shirtNumber: number | null) {
  yield `${fullName} (${position})`;
  if (shirtNumber !== null) yield `${fullName} #${shirtNumber}`;
  for (let n = 2; n < 1000; n += 1) yield `${fullName} ${n}`;
}

export function assignDisplayNames(
  newPlayers: ReadonlyArray<NewPlayerName>,
  existing: ReadonlyArray<ExistingName>,
): Map<string, DisplayNameResult> {
  const results = new Map<string, DisplayNameResult>();
  const taken = new Map<string, Set<string>>(); // teamId -> name keys in use
  const takenIn = (teamId: string) => {
    let set = taken.get(teamId);
    if (!set) taken.set(teamId, (set = new Set()));
    return set;
  };
  for (const player of existing) takenIn(player.teamId).add(nameKey(player.displayName));

  // 1. Explicit names first, so generated names never take them.
  for (const player of newPlayers) {
    if (!player.displayName) continue;
    const name = normaliseName(player.displayName);
    const set = takenIn(player.teamId);
    if (set.has(nameKey(name))) {
      results.set(player.key, { ok: false, message: `"${name}" is already used by another player in this team` });
      continue;
    }
    set.add(nameKey(name));
    results.set(player.key, { ok: true, displayName: name, disambiguated: false, reason: null });
  }

  // How many new players in each team share each full name.
  const sameNameCount = new Map<string, number>();
  for (const player of newPlayers) {
    if (player.displayName) continue;
    const k = `${player.teamId}|${nameKey(player.fullName)}`;
    sameNameCount.set(k, (sameNameCount.get(k) ?? 0) + 1);
  }

  for (const player of newPlayers) {
    if (player.displayName) continue;
    const fullName = normaliseName(player.fullName);
    const set = takenIn(player.teamId);
    const sharedInImport = (sameNameCount.get(`${player.teamId}|${nameKey(fullName)}`) ?? 0) > 1;

    // 2. The full name, when it's free and unique in this import.
    if (!sharedInImport && !set.has(nameKey(fullName))) {
      set.add(nameKey(fullName));
      results.set(player.key, { ok: true, displayName: fullName, disambiguated: false, reason: null });
      continue;
    }

    // 3. The first free candidate.
    const reason = sharedInImport
      ? `another new player in this import is also called ${fullName}`
      : `another player in this team is already shown as ${fullName}`;
    const candidates = [
      ...(sharedInImport ? [] : surnameCandidates(fullName)),
      ...fallbackCandidates(fullName, player.position, player.shirtNumber),
    ];
    const chosen = candidates.find((c) => !set.has(nameKey(c)));
    if (!chosen) {
      results.set(player.key, { ok: false, message: `Couldn't find a free display name for ${fullName}. Add a display_name` });
      continue;
    }
    set.add(nameKey(chosen));
    results.set(player.key, { ok: true, displayName: chosen, disambiguated: true, reason });
  }

  return results;
}
