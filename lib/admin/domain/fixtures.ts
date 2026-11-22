// Schedule checks for fixtures. These produce warnings, not errors: the
// organisers may really want two fixtures at one venue (different courts) or
// a team in two sports on one afternoon. The admin sees the warning and decides.

export type ScheduleSlot = {
  /** Existing fixture id, or a CSV row label like "Row 4" for new ones. */
  key: string;
  label: string;
  kickoffAt: string | null;
  durationMinutes: number;
  venue: string | null;
  teamIds: ReadonlyArray<string | null>;
};

export type ScheduleWarning = {
  key: string;
  otherKey: string;
  kind: "team_clash" | "venue_overlap";
  message: string;
};

/** Fallback when an event has no period lengths yet (most non-football sports). */
export const DEFAULT_FIXTURE_MINUTES = 60;

/**
 * Rough length of a fixture, used only for clash warnings: periods plus a
 * 10-minute break between each. Knockout extra time isn't counted.
 */
export function estimateDurationMinutes(periodMinutes: number | null, periodCount: number | null): number {
  if (!periodMinutes || !periodCount) return DEFAULT_FIXTURE_MINUTES;
  return periodMinutes * periodCount + 10 * (periodCount - 1);
}

function window(slot: ScheduleSlot): [number, number] | null {
  if (!slot.kickoffAt) return null;
  const start = new Date(slot.kickoffAt).getTime();
  if (Number.isNaN(start)) return null;
  return [start, start + slot.durationMinutes * 60_000];
}

function sameVenue(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLocaleLowerCase("en") === b.trim().toLocaleLowerCase("en");
}

/**
 * Warnings for each candidate against every other candidate and every
 * existing fixture. A pair is reported once, on the candidate.
 */
export function findScheduleWarnings(
  candidates: ReadonlyArray<ScheduleSlot>,
  existing: ReadonlyArray<ScheduleSlot>,
): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];
  const candidateKeys = new Set(candidates.map((c) => c.key));
  // An existing fixture being rescheduled by a candidate is replaced by it.
  const others = [...candidates, ...existing.filter((e) => !candidateKeys.has(e.key))];

  candidates.forEach((slot, index) => {
    const own = window(slot);
    if (!own) return;
    for (const [otherIndex, other] of others.entries()) {
      if (other.key === slot.key) continue;
      // Candidate pairs: report only once, on the later row.
      if (otherIndex < candidates.length && otherIndex > index) continue;
      const theirs = window(other);
      if (!theirs || own[0] >= theirs[1] || theirs[0] >= own[1]) continue;

      const ownTeams = slot.teamIds.filter((t): t is string => Boolean(t));
      const shared = ownTeams.some((t) => other.teamIds.includes(t));
      if (shared) {
        warnings.push({
          key: slot.key,
          otherKey: other.key,
          kind: "team_clash",
          message: `A team is also playing in ${other.label} at the same time`,
        });
      }
      if (sameVenue(slot.venue, other.venue)) {
        warnings.push({
          key: slot.key,
          otherKey: other.key,
          kind: "venue_overlap",
          message: `${other.label} is at the same venue at the same time`,
        });
      }
    }
  });
  return warnings;
}

// Same labels as Tayo's dashboard (app/admin/dashboard-data.ts).
const STAGE_LABELS: Record<string, string> = {
  final: "Final",
  third_place: "Third place",
  semi_final: "Semi-final",
};

export function fixtureLabel(stage: string, home: string | null, away: string | null): string {
  const stageLabel = STAGE_LABELS[stage];
  const teams =
    home && away
      ? `${home} v ${away}`
      : stageLabel
        ? `${stageLabel} (teams to be confirmed)`
        : (home ?? "Entrants to be confirmed");
  return stageLabel && home && away ? `${stageLabel}: ${teams}` : teams;
}
