import "server-only";
import { findDeadlineDrift } from "./domain/deadlines";
import { rpcDeadlineRules } from "./rpc";
import type { AdminSupabase } from "./server";

// Owner: admin backend. Deadlines never follow kickoffs (agreed with Mary), so
// every action that moves a kickoff or a fixture's matchday checks the
// matchday afterwards and returns a warning when its first kickoff is now less
// than admin_deadline_rules() minutes after the deadline, or before it. The
// write has already happened; the warning tells the admin to fix the deadline
// with setMatchdayDeadline before managers can pick after a kickoff.

export type DeadlineWarning = {
  matchdayId: string;
  matchdayNumber: number | null;
  /** "drift": the first kickoff is too close to (or before) the deadline. "check_failed": the check couldn't run. */
  kind: "drift" | "check_failed";
  deadlineAt: string | null;
  firstKickoffAt: string | null;
  /** Minutes from the deadline to the first kickoff (negative: kickoff first). */
  minutesBetween: number | null;
  /** The rule, from admin_deadline_rules(). */
  requiredMinutes: number | null;
  /** First kickoff minus the rule: the latest deadline that keeps it. */
  suggestedDeadlineAt: string | null;
  /** Ready to show, e.g. "Matchday 2's first kickoff (Mon 30 Nov, 14:15) is now only 15 minutes after its deadline (14:00)...". */
  message: string;
};

const dayTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Lagos",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
/** "Mon 30 Nov, 14:15" (WAT). */
const fmt = (iso: string) => dayTime.format(new Date(iso));

async function checkOne(supabase: AdminSupabase, matchdayId: string, minutesBefore: number): Promise<DeadlineWarning | null> {
  const [matchday, fixtures] = await Promise.all([
    supabase.from("matchdays").select("id, number, deadline_at").eq("id", matchdayId).maybeSingle(),
    supabase.from("fixtures").select("kickoff_at").eq("matchday_id", matchdayId).not("status", "in", "(cancelled,postponed)"),
  ]);
  if (matchday.error || fixtures.error || !matchday.data) return failed(matchdayId, matchday.data?.number ?? null);

  const drift = findDeadlineDrift(matchday.data.deadline_at, (fixtures.data ?? []).map((f) => f.kickoff_at), minutesBefore);
  if (!drift || !matchday.data.deadline_at) return null;

  const label = `Matchday ${matchday.data.number}`;
  const when =
    drift.minutesBetween < 0
      ? `is now before its deadline (${fmt(matchday.data.deadline_at)})`
      : `is now only ${drift.minutesBetween} minute${drift.minutesBetween === 1 ? "" : "s"} after its deadline (${fmt(matchday.data.deadline_at)})`;
  return {
    matchdayId,
    matchdayNumber: matchday.data.number,
    kind: "drift",
    deadlineAt: matchday.data.deadline_at,
    firstKickoffAt: drift.firstKickoffAt,
    minutesBetween: drift.minutesBetween,
    requiredMinutes: minutesBefore,
    suggestedDeadlineAt: drift.suggestedDeadlineAt,
    message: `${label}'s first kickoff (${fmt(drift.firstKickoffAt)}) ${when}. The deadline should be at least ${minutesBefore} minutes before it: move it to ${fmt(drift.suggestedDeadlineAt)} or earlier.`,
  };
}

function failed(matchdayId: string, number: number | null): DeadlineWarning {
  console.error("[admin] deadline check failed", { matchdayId });
  return {
    matchdayId,
    matchdayNumber: number,
    kind: "check_failed",
    deadlineAt: null,
    firstKickoffAt: null,
    minutesBetween: null,
    requiredMinutes: null,
    suggestedDeadlineAt: null,
    message: `The change was saved, but ${number ? `matchday ${number}'s` : "the matchday's"} deadline couldn't be checked. Check it on the matchdays page.`,
  };
}

/** Checks each matchday once. Never throws: a failed check comes back as a check_failed warning. */
export async function checkMatchdayDeadlines(
  supabase: AdminSupabase,
  matchdayIds: ReadonlyArray<string | null | undefined>,
): Promise<DeadlineWarning[]> {
  const ids = [...new Set(matchdayIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  try {
    const rules = await rpcDeadlineRules(supabase);
    if (!rules.ok) return ids.map((id) => failed(id, null));
    const results = await Promise.all(ids.map((id) => checkOne(supabase, id, rules.data)));
    return results.filter((w): w is DeadlineWarning => w !== null);
  } catch {
    return ids.map((id) => failed(id, null));
  }
}
