// Matchday deadlines. Mary owns the recalculation in the database (her trigger
// keeps deadline_at at the rules offset before the first kickoff, unless the
// admin has overridden it). These helpers are for the admin page: showing the
// worked-out deadline next to an override, and checking an override is sane.
// The offset comes from the rules config and is passed in, never written here.

/** The worked-out deadline: `minutesBefore` before the earliest kickoff, or null if none is set. */
export function computeDeadline(kickoffs: ReadonlyArray<string | null>, minutesBefore: number): string | null {
  let first: number | null = null;
  for (const kickoff of kickoffs) {
    if (!kickoff) continue;
    const t = new Date(kickoff).getTime();
    if (Number.isNaN(t)) continue;
    if (first === null || t < first) first = t;
  }
  if (first === null) return null;
  return new Date(first - minutesBefore * 60_000).toISOString();
}

/**
 * Problems with an admin's override, in plain words. An override after the
 * first kickoff would let managers pick after a match has started.
 */
export function checkDeadlineOverride(
  overrideAt: string,
  kickoffs: ReadonlyArray<string | null>,
): string | null {
  const override = new Date(overrideAt).getTime();
  if (Number.isNaN(override)) return "That isn't a valid date and time.";
  const firstKickoff = computeDeadline(kickoffs, 0);
  if (firstKickoff && override > new Date(firstKickoff).getTime()) {
    return "The deadline can't be after the matchday's first kickoff.";
  }
  return null;
}
