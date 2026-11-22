// Owner: admin backend. Input validation for every admin action: one source of
// truth, used by the server actions (never trust FormData or client objects)
// and available to Tayo's forms for instant feedback.
//
// Rule values (price range and step, deadline offset) are NOT here: they come
// from the database. Schemas check shape and type; the domain functions and the
// database check the rules.
//
// CSV rows are validated column by column in lib/admin/csv/*, because their
// messages must name the row and column in plain words.

import { z } from "zod";
import type { ActionResult, FieldErrors } from "./result";
import { fail } from "./result";
import { normaliseName } from "./domain/names";
import {
  ADMIN_SETTABLE_FIXTURE_STATUSES,
  PLAYER_POSITIONS,
  PLAYER_STATUSES,
  RESULT_FORMATS,
} from "./types";

// ---------------------------------------------------------------------------
// Field schemas
// ---------------------------------------------------------------------------

export const id = z.uuid({ error: "Not a valid id" });

/** A person's or thing's name: whitespace collapsed, 1 to `max` characters. */
const name = (max: number) =>
  z
    .string()
    .transform(normaliseName)
    .pipe(z.string().min(1, "Required").max(max, `At most ${max} characters`));

const optionalText = (max: number) =>
  z
    .string()
    .transform(normaliseName)
    .pipe(z.string().max(max, `At most ${max} characters`))
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens, like table-tennis")
  .max(60);

export const stage = z
  .string()
  .transform((v) => normaliseName(v).toLowerCase().replace(/[\s-]+/g, "_"))
  .pipe(z.string().regex(/^[a-z0-9_]{1,40}$/, "Letters, numbers and underscores, like league or third_place"));

export const year = z.coerce.number().int().min(1, "Year 1 to 5").max(5, "Year 1 to 5");
export const shirtNumber = z.coerce.number().int().min(0, "0 to 99").max(99, "0 to 99").nullable();
/** Price in tenths of a million (55 = N5.5m). The range is checked by the database (admin_price_rules() from PR 3). */
export const priceTenths = z.coerce.number().int("Prices go in steps; send tenths of a million").positive();
export const position = z.enum(PLAYER_POSITIONS, { error: "GK, DEF, MID or FWD" });
export const playerStatus = z.enum(PLAYER_STATUSES, { error: "available, injured, suspended or left" });
export const resultFormat = z.enum(RESULT_FORMATS, { error: "timed, sets, head_to_head or ranked" });
export const isoDateTime = z.iso.datetime({ offset: true, error: "Not a valid date and time" });
const positiveSmallInt = z.coerce.number().int().min(1).max(32767);

// ---------------------------------------------------------------------------
// Sports, events, teams
// ---------------------------------------------------------------------------

export const createSportInput = z.object({
  name: name(60),
  slug,
  resultFormat,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const updateSportInput = createSportInput.partial().extend({ sportId: id });

export const createEventInput = z.object({
  sportId: id,
  name: name(80),
  slug,
  periodMinutes: positiveSmallInt.nullable().optional(),
  periodCount: positiveSmallInt.nullable().optional(),
  extraPeriodMinutes: positiveSmallInt.nullable().optional(),
});

export const updateEventInput = createEventInput.omit({ sportId: true }).partial().extend({ eventId: id });

export const updateTeamInput = z.object({
  teamId: id,
  name: name(40).optional(),
  shortName: name(6).optional(),
  classLabel: name(40).optional(),
  coaches: z.array(name(60)).max(6, "At most 6 coaches").optional(),
});

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export const createPlayerInput = z.object({
  teamId: id,
  fullName: name(80),
  /** Leave empty to have one chosen (see domain/display-names.ts). */
  displayName: optionalText(40),
  position,
  shirtNumber: shirtNumber.optional(),
  /** Leave empty after the price lock: late additions get the lowest price. */
  priceTenths: priceTenths.optional(),
  status: playerStatus.default("available"),
});

export const updatePlayerInput = z.object({
  playerId: id,
  fullName: name(80).optional(),
  displayName: name(40).optional(),
  position: position.optional(),
  shirtNumber: shirtNumber.optional(),
});

export const setPlayerStatusInput = z.object({ playerId: id, status: playerStatus });

export const setPlayerPriceInput = z.object({ playerId: id, priceTenths });

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export const createFixtureInput = z
  .object({
    eventId: id,
    stage: stage.default("league"),
    homeTeamId: id.nullable().optional(),
    awayTeamId: id.nullable().optional(),
    kickoffAt: isoDateTime.nullable().optional(),
    venue: optionalText(100),
    matchdayId: id.nullable().optional(),
  })
  .refine((v) => !v.homeTeamId || !v.awayTeamId || v.homeTeamId !== v.awayTeamId, {
    message: "A team can't play itself",
    path: ["awayTeamId"],
  });

export const updateFixtureInput = z
  .object({
    fixtureId: id,
    stage: stage.optional(),
    homeTeamId: id.nullable().optional(),
    awayTeamId: id.nullable().optional(),
    venue: optionalText(100),
    matchdayId: id.nullable().optional(),
  })
  .refine((v) => !v.homeTeamId || !v.awayTeamId || v.homeTeamId !== v.awayTeamId, {
    message: "A team can't play itself",
    path: ["awayTeamId"],
  });

export const rescheduleFixtureInput = z.object({ fixtureId: id, kickoffAt: isoDateTime.nullable() });

export const setFixtureStatusInput = z.object({
  fixtureId: id,
  status: z.enum(ADMIN_SETTABLE_FIXTURE_STATUSES, { error: "scheduled, postponed or cancelled" }),
});

/** clientEventId: crypto.randomUUID() made when the admin confirms, so a retry records once. */
export const recordWalkoverInput = z.object({
  fixtureId: id,
  awardedTeamId: id,
  clientEventId: id,
  /** The awarded score. Bolu's default is 3 (football: 3-0). */
  points: z.number().int().min(1).max(99).optional(),
});

export const fillKnockoutsInput = z.object({ eventId: id });

// ---------------------------------------------------------------------------
// Officials and console holders
// ---------------------------------------------------------------------------

/** Admin can't be granted from the app (guard_profile_role), so only these two. */
export const setRoleInput = z.object({
  profileId: id,
  role: z.enum(["user", "official"], { error: "user or official" }),
});

/** Sets the holder to exactly this account (null clears it). Safe to retry. */
export const setConsoleHolderInput = z.object({ fixtureId: id, profileId: id.nullable() });

// ---------------------------------------------------------------------------
// Matchdays (Mary owns the recalculation; the admin only writes the override)
// ---------------------------------------------------------------------------

export const setMatchdayDeadlineInput = z.object({ matchdayId: id, deadlineAt: isoDateTime });

export const matchdayIdInput = z.object({ matchdayId: id });

// ---------------------------------------------------------------------------
// Corrections (through Bolu's lib/live API)
// ---------------------------------------------------------------------------

export const correctionReason = z
  .string()
  .transform(normaliseName)
  .pipe(z.string().min(5, "Give a short reason (at least 5 characters)").max(300));

export const voidEventInput = z.object({ clientEventId: id, reason: correctionReason });

/**
 * Void one event and, optionally, record its replacement (a RecordEventInput
 * for the same fixture, with its own new clientEventId, checked by Bolu's
 * recordMatchEvent). Retrying with the same ids is safe: voiding twice and
 * recording the same clientEventId twice both happen once.
 */
export const correctMatchEventInput = z.object({
  voidClientEventId: id,
  reason: correctionReason,
  replacement: z.object({ fixtureId: id, clientEventId: id, type: z.string() }).loose().optional(),
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export const announcementInput = z
  .object({
    message: name(280),
    tone: z.enum(["info", "warning"]).default("info"),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
  })
  .refine((v) => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(), {
    message: "The end must be after the start",
    path: ["endsAt"],
  });

export const updateAnnouncementInput = z.object({ announcementId: id }).and(announcementInput);

export const announcementIdInput = z.object({ announcementId: id });

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

/** importId is made by the browser when the admin opens the import, so a retried commit is a no-op. */
export const importCommitInput = <T extends z.ZodType>(row: T) =>
  z.object({
    importId: id,
    rows: z.array(row).min(1, "Nothing to import").max(1000, "At most 1000 rows per import"),
  });

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export const auditLogFilter = z.object({
  table: z.string().trim().max(60).optional(),
  actorId: id.optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  /** Opaque cursor from the previous page. */
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

export type Parsed<T> = { ok: true; data: T } | { ok: false; result: ActionResult<never> };

/**
 * Validates untrusted input. On failure returns a ready-made admin.invalid_input
 * result with fieldErrors, so actions can `if (!parsed.ok) return parsed.result`.
 */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): Parsed<z.output<T>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const flat = z.flattenError(result.error);
  const fieldErrors: FieldErrors = {};
  for (const [field, messages] of Object.entries(flat.fieldErrors)) {
    if (Array.isArray(messages) && messages.length > 0) fieldErrors[field] = messages;
  }
  const first = flat.formErrors[0] ?? Object.values(fieldErrors)[0]?.[0] ?? "Check the highlighted fields.";
  return { ok: false, result: fail("admin.invalid_input", first, { fieldErrors }) };
}

// ---------------------------------------------------------------------------
// Import commits: the validated rows from a preview, plus their row numbers
// (use commitRows() from lib/admin/csv/preview.ts). Shape only; the database
// re-checks every rule.
// ---------------------------------------------------------------------------

const rowNumber = z.number().int().min(2);

export const playerImportRowInput = z.object({
  rowNumber,
  existingId: id.nullable(),
  teamId: id,
  fullName: z.string().max(200),
  displayName: z.string().max(200),
  position,
  shirtNumber: z.number().int().nullable(),
  priceTenths: z.number().int(),
  status: playerStatus,
});

export const priceImportRowInput = z.object({ rowNumber, playerId: id, priceTenths: z.number().int() });

export const fixtureImportRowInput = z.object({
  rowNumber,
  existingId: id.nullable(),
  ref: z.string().max(40).nullable(),
  eventId: id,
  stage: z.string().max(40),
  homeTeamId: id.nullable(),
  awayTeamId: id.nullable(),
  kickoffAt: isoDateTime.nullable(),
  venue: z.string().max(200).nullable(),
  matchdayId: id.nullable(),
});

export const commitPlayersInput = importCommitInput(playerImportRowInput);
export const commitPricesInput = importCommitInput(priceImportRowInput);
export const commitFixturesInput = importCommitInput(fixtureImportRowInput);

/** CSV text sent for a preview. About 1 MB is far more than any real file (ours are under 10 KB). */
export const csvTextInput = z.string().max(1_000_000, "The file is too big. Split it into smaller files.");

export const listPlayersFilter = z
  .object({
    teamId: id.optional(),
    position: position.optional(),
    status: playerStatus.optional(),
    search: z.string().trim().max(80).optional(),
  })
  .default({});
