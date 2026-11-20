// Fixtures CSV: create fixtures and set real kickoff times. Kickoffs are typed
// in WAT and converted to UTC here. Format: docs/admin-csv-formats.md.
//
// Matching a row to an existing fixture:
//   1. by `ref`, when the column is present and the ref exists;
//   2. otherwise by (event, stage, home, away), empty teams counting as equal.
//      One match: update it (and give it the ref, if the row has one and the
//      fixture has none). Several: error, add a ref. None: a new fixture.
// Teams and event of an existing fixture can only change through a ref match.

import { estimateDurationMinutes, findScheduleWarnings, type ScheduleSlot } from "../domain/fixtures";
import { nameKey, normaliseName } from "../domain/names";
import { utcToWat, watToUtc } from "../domain/wat";
import type { FixtureStatus, ImportPreview, PreviewRow } from "../types";
import { readTable } from "./parse";
import { buildPreview, cellError, fileErrorPreview, finishRow, rowError } from "./preview";

export const FIXTURE_COLUMNS = {
  required: ["sport", "stage", "home", "away", "date", "kickoff_wat"],
  optional: ["event", "venue", "matchday", "ref"],
} as const;

export type ExistingFixture = {
  id: string;
  ref: string | null;
  eventId: string;
  stage: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  kickoffAt: string | null;
  venue: string | null;
  matchdayId: string | null;
  status: FixtureStatus;
};

export type FixturesImportContext = {
  sports: ReadonlyArray<{ id: string; slug: string; name: string }>;
  events: ReadonlyArray<{
    id: string;
    sportId: string;
    slug: string;
    name: string;
    periodMinutes: number | null;
    periodCount: number | null;
  }>;
  teams: ReadonlyArray<{ id: string; shortName: string; name: string }>;
  matchdays: ReadonlyArray<{ id: string; number: number }>;
  fixtures: ReadonlyArray<ExistingFixture>;
  /** False until the fixtures.ref migration is applied; a ref column is then a file error. */
  supportsRef: boolean;
  now: Date;
};

/** One validated row, as sent to admin_import_fixtures. */
export type FixtureImportRow = {
  existingId: string | null;
  ref: string | null;
  eventId: string;
  stage: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  kickoffAt: string | null;
  venue: string | null;
  matchdayId: string | null;
};

const STARTED: ReadonlySet<FixtureStatus> = new Set(["live", "half_time", "full_time", "walkover"]);

export function previewFixturesCsv(input: string, context: FixturesImportContext): ImportPreview<FixtureImportRow> {
  const table = readTable(input, FIXTURE_COLUMNS);
  if (!table.ok) return fileErrorPreview(table.errors);
  if (table.columns.includes("ref") && !context.supportsRef) {
    return fileErrorPreview(['The "ref" column isn\'t available yet. Remove it and import again']);
  }

  const teamShort = (id: string | null) =>
    id ? (context.teams.find((t) => t.id === id)?.shortName ?? "?") : "TBC";
  const findTeam = (raw: string) =>
    context.teams.find((t) => nameKey(t.shortName) === nameKey(raw) || nameKey(t.name) === nameKey(raw));
  const eventById = new Map(context.events.map((e) => [e.id, e]));
  const fixtureByRef = new Map(
    context.fixtures.filter((f) => f.ref).map((f) => [nameKey(f.ref as string), f]),
  );
  const claimed = new Map<string, number>();

  type Built = { row: PreviewRow<FixtureImportRow>; slot: ScheduleSlot | null };
  const built: Built[] = table.rows.map(({ rowNumber, values }) => {
    const errors = [...(table.rowErrors.get(rowNumber) ?? [])];
    const warnings: string[] = [];
    const changes: string[] = [];
    const err = (column: string, problem: string) => errors.push(cellError(rowNumber, column, problem));

    // sport and event
    const sport = context.sports.find(
      (s) => nameKey(s.slug) === nameKey(values.sport) || nameKey(s.name) === nameKey(values.sport),
    );
    if (values.sport === "") err("sport", "is missing");
    else if (!sport) err("sport", `"${values.sport}" isn't a sport`);

    let event: FixturesImportContext["events"][number] | undefined;
    if (sport) {
      const sportEvents = context.events.filter((e) => e.sportId === sport.id);
      if (values.event === "") {
        if (sportEvents.length === 1) event = sportEvents[0];
        else err("event", `${sport.name} has ${sportEvents.length} events; say which (${sportEvents.map((e) => e.name).join(", ")})`);
      } else {
        event = sportEvents.find(
          (e) => nameKey(e.slug) === nameKey(values.event) || nameKey(e.name) === nameKey(values.event),
        );
        if (!event) err("event", `"${values.event}" isn't an event in ${sport.name}`);
      }
    }

    // stage
    const stage = values.stage === "" ? "league" : normaliseName(values.stage).toLowerCase().replace(/[\s-]+/g, "_");
    if (!/^[a-z0-9_]{1,40}$/.test(stage)) err("stage", `"${values.stage}" isn't a stage; use words like league, final or third_place`);

    // teams
    let homeTeamId: string | null = null;
    let awayTeamId: string | null = null;
    if (values.home !== "") {
      const team = findTeam(values.home);
      if (team) homeTeamId = team.id;
      else err("home", `"${values.home}" isn't a team; use Y1 to Y5`);
    }
    if (values.away !== "") {
      const team = findTeam(values.away);
      if (team) awayTeamId = team.id;
      else err("away", `"${values.away}" isn't a team; use Y1 to Y5`);
    }
    if ((values.home === "") !== (values.away === "")) {
      err(values.home === "" ? "home" : "away", "is missing; give both teams, or leave both empty if they aren't known yet");
    }
    if (homeTeamId && homeTeamId === awayTeamId) err("away", "a team can't play itself");

    // kickoff
    let kickoffAt: string | null = null;
    if (values.date === "" && values.kickoff_wat === "") {
      warnings.push(rowError(rowNumber, "no date or kickoff time yet; the fixture shows as time to be confirmed"));
    } else if (values.date === "") {
      err("date", "is missing (there's a kickoff time)");
    } else if (values.kickoff_wat === "") {
      err("kickoff_wat", "is missing (there's a date)");
    } else {
      const parsed = watToUtc(values.date, values.kickoff_wat);
      if (parsed.ok) kickoffAt = parsed.date.toISOString();
      else err(/date/.test(parsed.message) ? "date" : "kickoff_wat", parsed.message);
    }

    // venue, matchday, ref
    const venue = values.venue === "" ? null : normaliseName(values.venue);
    if (venue && venue.length > 100) err("venue", "is longer than 100 characters");

    let matchdayId: string | null = null;
    if (values.matchday !== "") {
      const number = /^\d{1,2}$/.test(values.matchday) ? Number(values.matchday) : NaN;
      const matchday = context.matchdays.find((m) => m.number === number);
      if (matchday) matchdayId = matchday.id;
      else err("matchday", `"${values.matchday}" isn't a matchday; use ${context.matchdays.map((m) => m.number).join(", ")}`);
    }

    const ref = values.ref === "" ? null : values.ref;
    if (ref && !/^[A-Za-z0-9_-]{1,40}$/.test(ref)) err("ref", "use letters, numbers, - and _ only (up to 40), like FB-MD1-1");

    // Find the existing fixture.
    let existing: ExistingFixture | undefined;
    if (event && errors.length === 0) {
      existing = ref ? fixtureByRef.get(nameKey(ref)) : undefined;
      if (!existing) {
        const natural = context.fixtures.filter(
          (f) =>
            f.eventId === event.id &&
            f.stage === stage &&
            f.homeTeamId === homeTeamId &&
            f.awayTeamId === awayTeamId &&
            (!ref || f.ref === null),
        );
        if (natural.length === 1) existing = natural[0];
        else if (natural.length > 1) {
          errors.push(
            rowError(
              rowNumber,
              `matches ${natural.length} existing ${event.name} ${stage} fixtures for ${teamShort(homeTeamId)} v ${teamShort(awayTeamId)}. Add a ref column to say which`,
            ),
          );
        }
      }
    }
    if (existing) {
      const first = claimed.get(existing.id);
      if (first !== undefined) errors.push(rowError(rowNumber, `is the same fixture as row ${first}`));
      else claimed.set(existing.id, rowNumber);
    }

    const value: FixtureImportRow = {
      existingId: existing?.id ?? null,
      ref,
      eventId: event?.id ?? "",
      stage,
      homeTeamId,
      awayTeamId,
      kickoffAt,
      venue,
      matchdayId,
    };

    if (existing) {
      const started = STARTED.has(existing.status);
      if (existing.eventId !== value.eventId) changes.push(`event → ${event?.name}`);
      if (existing.stage !== stage) changes.push(`stage ${existing.stage} → ${stage}`);
      if (existing.homeTeamId !== homeTeamId || existing.awayTeamId !== awayTeamId) {
        changes.push(
          `teams ${teamShort(existing.homeTeamId)} v ${teamShort(existing.awayTeamId)} → ${teamShort(homeTeamId)} v ${teamShort(awayTeamId)}`,
        );
      }
      if (started && changes.length > 0) {
        errors.push(rowError(rowNumber, "this fixture has started, so its event, stage and teams can't change"));
      }
      if (!sameInstant(existing.kickoffAt, kickoffAt)) {
        changes.push(`kickoff ${watLabel(existing.kickoffAt)} → ${watLabel(kickoffAt)}`);
        if (started) warnings.push(rowError(rowNumber, "this fixture has already started; changing its kickoff only changes the listing"));
      }
      if ((existing.venue ?? null) !== venue) changes.push(`venue ${existing.venue ?? "none"} → ${venue ?? "none"}`);
      if (existing.matchdayId !== matchdayId) {
        const number = (id: string | null) => context.matchdays.find((m) => m.id === id)?.number ?? "none";
        changes.push(`matchday ${number(existing.matchdayId)} → ${number(matchdayId)}`);
      }
      if (ref && existing.ref === null) changes.push(`ref → ${ref}`);
    }

    if (kickoffAt && new Date(kickoffAt).getTime() < context.now.getTime() && (!existing || changes.some((c) => c.startsWith("kickoff")))) {
      warnings.push(rowError(rowNumber, "this kickoff time is in the past"));
    }

    const status = existing ? (changes.length > 0 ? "update" : "unchanged") : "new";
    const row = finishRow(rowNumber, errors, warnings, changes, status, value);
    const slot: ScheduleSlot | null =
      row.value && event
        ? {
            key: existing?.id ?? `row:${rowNumber}`,
            label: `row ${rowNumber} (${teamShort(homeTeamId)} v ${teamShort(awayTeamId)})`,
            kickoffAt,
            durationMinutes: estimateDurationMinutes(event.periodMinutes, event.periodCount),
            venue,
            teamIds: [homeTeamId, awayTeamId],
          }
        : null;
    return { row, slot };
  });

  // Clash warnings: teams double-booked and venues overlapping.
  const candidates = built.map((b) => b.slot).filter((s): s is ScheduleSlot => s !== null);
  const existingSlots: ScheduleSlot[] = context.fixtures
    .filter((f) => f.status !== "cancelled" && f.status !== "postponed")
    .map((f) => {
      const event = eventById.get(f.eventId);
      return {
        key: f.id,
        label: `the existing ${event?.name ?? "fixture"} ${teamShort(f.homeTeamId)} v ${teamShort(f.awayTeamId)} at ${watLabel(f.kickoffAt)}`,
        kickoffAt: f.kickoffAt,
        durationMinutes: estimateDurationMinutes(event?.periodMinutes ?? null, event?.periodCount ?? null),
        venue: f.venue,
        teamIds: [f.homeTeamId, f.awayTeamId],
      };
    });
  const warningsByKey = new Map<string, string[]>();
  for (const warning of findScheduleWarnings(candidates, existingSlots)) {
    const list = warningsByKey.get(warning.key) ?? [];
    list.push(warning.message);
    warningsByKey.set(warning.key, list);
  }
  for (const { row, slot } of built) {
    if (!slot) continue;
    for (const message of warningsByKey.get(slot.key) ?? []) {
      row.warnings.push(rowError(row.rowNumber, message));
    }
  }

  return buildPreview(built.map((b) => b.row));
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

function watLabel(instant: string | null): string {
  if (!instant) return "TBC";
  const { date, time } = utcToWat(instant);
  return `${date} ${time}`;
}
