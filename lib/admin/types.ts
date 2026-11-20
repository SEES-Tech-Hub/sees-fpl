// Owner: admin backend. Domain types shared by admin queries, actions, CSV
// importers and Tayo's pages.
//
// Enum types come from the generated lib/supabase/types.ts. Row types for
// tables our own migrations add live here with a TODO(regen) marker until Tayo
// applies the migration and regenerates the types; then they are deleted.

import { Constants, type Database } from "@/lib/supabase/types";

type DbEnums = Database["public"]["Enums"];

export type AppRole = DbEnums["app_role"];
export type PlayerPosition = DbEnums["player_position"];
export type PlayerStatus = DbEnums["player_status"];
export type ResultFormat = DbEnums["result_format"];
export type FixtureStatus = DbEnums["fixture_status"];
export type MatchdayStatus = DbEnums["matchday_status"];

export const PLAYER_POSITIONS = Constants.public.Enums.player_position;
export const PLAYER_STATUSES = Constants.public.Enums.player_status;
export const RESULT_FORMATS = Constants.public.Enums.result_format;
export const APP_ROLES = Constants.public.Enums.app_role;

/** Fixture statuses an admin may set by hand (Bolu's guard allows only these). */
export const ADMIN_SETTABLE_FIXTURE_STATUSES = ["scheduled", "postponed", "cancelled"] as const;
export type AdminSettableFixtureStatus = (typeof ADMIN_SETTABLE_FIXTURE_STATUSES)[number];

// ---------------------------------------------------------------------------
// CSV import previews
// ---------------------------------------------------------------------------

/** What committing a row would do. */
export type PreviewRowStatus = "new" | "update" | "unchanged" | "error";

export type PreviewRow<T> = {
  /** Spreadsheet row number: the header is row 1, the first data row is row 2. */
  rowNumber: number;
  status: PreviewRowStatus;
  /** Plain-words problems that block the import, e.g. "Row 14, price: 11.0 is above the maximum of 10.0". */
  errors: string[];
  /** Things to check that don't block it, e.g. a generated display name. */
  warnings: string[];
  /** Fields that would change on an existing row, in plain words. */
  changes: string[];
  /** The validated row to send to the commit RPC; null when the row has errors. */
  value: T | null;
};

export type ImportPreview<T> = {
  /** File-level problems (empty file, unknown or missing columns). Nothing else is checked when present. */
  fileErrors: string[];
  rows: PreviewRow<T>[];
  counts: Record<PreviewRowStatus, number>;
  /** True when there are no file errors and no row errors. */
  canCommit: boolean;
};

/** What the import RPCs return. A re-run with the same importId returns the first run's counts. */
export type ImportCounts = {
  inserted: number;
  updated: number;
  unchanged: number;
  /** True when this importId had already been applied, so nothing was written this time. */
  alreadyApplied: boolean;
};
