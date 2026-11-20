// Owner: admin backend. Error codes for admin actions, and the mapping from
// Postgres errors to messages that are safe to show the admin.
//
// Rule violations raised by our SQL use Bolu's live_fail(code, message): SQLSTATE
// P0001 with a stable code in HINT ('admin.price_locked', 'live.has_events').
// Those messages are written for people, so they are passed through. Every
// other database message is replaced with a plain one; raw SQL never reaches
// the browser.

import type { AdminError } from "./result";

/** Codes our own SQL and actions produce. Listed in docs/admin-backend.md. */
export const ADMIN_ERROR_CODES = [
  "admin.invalid_input", // the request failed validation; see fieldErrors
  "admin.not_found", // the row doesn't exist (or RLS hides it)
  "admin.conflict", // a unique value is already taken (23505)
  "admin.in_use", // can't delete or change: other rows point at it (23503)
  "admin.forbidden", // the database refused the write for this account (42501)
  "admin.own_role", // an admin tried to change their own role
  "admin.role_forbidden", // admin can only be granted or removed in the SQL editor
  "admin.price_locked", // price change after the matchday 1 deadline
  "admin.price_out_of_range", // outside the allowed price range (admin_price_rules() from PR 3)
  "admin.player_ambiguous", // two players share that name; give a display_name
  "admin.import_invalid", // the import has rows with errors; nothing was written
  "admin.rule_violation", // another database rule (message comes from the database)
  "admin.not_ready", // depends on a teammate's function that hasn't landed yet
  "admin.unavailable", // network or database busy (retryable)
  "admin.unexpected", // anything else; logged on the server
] as const;

export type OwnAdminErrorCode = (typeof ADMIN_ERROR_CODES)[number];

/**
 * Bolu's guards (for example 'live.has_events' when postponing a fixture that
 * has match events) reach admin actions too. Their code is kept as it is so
 * the UI can tell them apart, and their message is shown as it is.
 */
export type LiveRuleCode = `live.${string}`;

export type AdminErrorCode = OwnAdminErrorCode | LiveRuleCode;

/** The parts of a PostgrestError (or any thrown value) this module reads. */
export type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const OWN_CODES = new Set<string>(ADMIN_ERROR_CODES);

const RETRYABLE_SQLSTATES = new Set([
  "40001", // serialization failure
  "40P01", // deadlock
  "53300", // too many connections
  "57014", // statement timeout
  "08000", // connection exception
  "08003",
  "08006",
]);

// guard_profile_role (Tayo's) raises plain exceptions with no HINT. Their text
// is fixed in the base schema, so they are matched exactly.
const ROLE_GUARD_MESSAGES: Record<string, { code: OwnAdminErrorCode; message: string }> = {
  "You cannot change your own role": {
    code: "admin.own_role",
    message: "You can't change your own role.",
  },
  "Only an admin can change roles": {
    code: "admin.forbidden",
    message: "Only an admin can change roles.",
  },
  "Admin can only be granted or removed in the database": {
    code: "admin.role_forbidden",
    message: "Admin can only be granted or removed by Tayo in the database.",
  },
};

// Check constraints whose failure an admin can act on.
const CHECK_CONSTRAINT_MESSAGES: Record<string, string> = {
  players_price_tenths_check: "That price is outside the allowed range.",
  players_shirt_number_check: "Shirt numbers go from 0 to 99.",
  teams_year_check: "Year must be between 1 and 5.",
  fixtures_check: "A team can't play itself.",
};

function constraintName(error: DatabaseErrorLike): string | null {
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  const match = text.match(/constraint "([^"]+)"/);
  return match?.[1] ?? null;
}

function unexpected(): AdminError {
  return {
    code: "admin.unexpected",
    message: "Something went wrong. Try again, and tell the admin backend owner if it keeps happening.",
    retryable: false,
  };
}

/**
 * Turns a database error into an AdminError that is safe to return to the
 * client. Callers log the original error (ids only, no PII) before returning.
 */
export function mapDatabaseError(error: DatabaseErrorLike | null | undefined): AdminError {
  if (!error) return unexpected();
  const code = error.code ?? "";
  const hint = error.hint ?? "";
  const message = error.message ?? "";

  if (code === "P0001") {
    if (OWN_CODES.has(hint)) {
      return {
        code: hint as OwnAdminErrorCode,
        message,
        retryable: hint === "admin.unavailable",
      };
    }
    if (hint.startsWith("live.")) {
      return { code: hint as LiveRuleCode, message, retryable: false };
    }
    const roleGuard = ROLE_GUARD_MESSAGES[message];
    if (roleGuard) return { ...roleGuard, retryable: false };
    return {
      code: "admin.rule_violation",
      message: "The database refused this change.",
      retryable: false,
    };
  }

  switch (code) {
    case "23505":
      return {
        code: "admin.conflict",
        message: "That already exists. Use a different name or value.",
        retryable: false,
      };
    case "23503":
      return {
        code: "admin.in_use",
        message: "Other records depend on this, so it can't be changed or removed.",
        retryable: false,
      };
    case "23514": {
      const name = constraintName(error);
      return {
        code: "admin.invalid_input",
        message: (name && CHECK_CONSTRAINT_MESSAGES[name]) ?? "A value is outside what's allowed.",
        retryable: false,
      };
    }
    case "23502":
      return { code: "admin.invalid_input", message: "A required value is missing.", retryable: false };
    case "22P02":
    case "22007":
    case "22008":
      return { code: "admin.invalid_input", message: "A value isn't in the right format.", retryable: false };
    case "42501":
      return {
        code: "admin.forbidden",
        message: "Your account isn't allowed to make this change.",
        retryable: false,
      };
    case "PGRST116":
      return { code: "admin.not_found", message: "That record wasn't found.", retryable: false };
  }

  if (RETRYABLE_SQLSTATES.has(code) || isNetworkError(error)) {
    return {
      code: "admin.unavailable",
      message: "The database is busy or unreachable. Try again in a moment.",
      retryable: true,
    };
  }

  return unexpected();
}

function isNetworkError(error: DatabaseErrorLike): boolean {
  // supabase-js reports fetch failures with an empty code and the fetch message.
  if (error.code) return false;
  return /fetch failed|network|ECONNRESET|ETIMEDOUT|ENOTFOUND|timed out/i.test(error.message ?? "");
}
