// Live scores: turning database and network errors into LiveError values.
// Pure functions, safe on server and client.
import { LIVE_ERROR_CODES, type LiveError, type LiveErrorCode } from "./types";

/** The parts of a Supabase (PostgREST) error this module reads. */
export type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  hint?: string | null;
};

const KNOWN_CODES = new Set<string>(LIVE_ERROR_CODES);

// Postgres and PostgREST codes that mean "try again later".
const RETRYABLE_SQLSTATES = new Set([
  "40001", // serialization failure
  "40P01", // deadlock
  "53300", // too many connections
  "57014", // statement timeout
  "57P01", // server shutting down
  "PGRST000", // could not connect to the database
  "PGRST001",
  "PGRST002",
  "PGRST003", // connection pool timed out
]);

const FALLBACK_MESSAGES: Record<"forbidden" | "unavailable" | "unknown", string> = {
  forbidden: "You don't have permission to do that. Check you're signed in as an official.",
  unavailable: "Couldn't reach the server. The action will be retried.",
  unknown: "Something went wrong on the server. Try again, or tell the admin.",
};

export function liveError(code: LiveErrorCode, message: string, retryable = false): LiveError {
  return { code, message, retryable };
}

/**
 * Maps an error from `supabase.rpc(...)` to a LiveError.
 *
 * The database raises rule violations with a code in HINT, such as
 * `live.not_holder`, and a message written for the official. Those pass
 * through unchanged and are never retryable.
 */
export function toLiveError(error: PostgrestLikeError | null | undefined): LiveError {
  const hint = error?.hint ?? "";
  if (hint.startsWith("live.")) {
    const code = hint.slice("live.".length);
    if (KNOWN_CODES.has(code)) {
      return liveError(code as LiveErrorCode, error?.message || FALLBACK_MESSAGES.unknown);
    }
  }

  const sqlstate = error?.code ?? "";
  if (sqlstate === "42501") {
    return liveError("forbidden", FALLBACK_MESSAGES.forbidden);
  }
  if (!sqlstate || RETRYABLE_SQLSTATES.has(sqlstate)) {
    // No code at all means the request never got an answer (network error).
    return liveError("unavailable", FALLBACK_MESSAGES.unavailable, true);
  }
  return liveError("unknown", FALLBACK_MESSAGES.unknown);
}

/** For errors thrown (not returned) while calling Supabase, e.g. fetch failing. */
export function toLiveErrorFromThrown(thrown: unknown): LiveError {
  if (thrown && typeof thrown === "object" && "code" in thrown) {
    return toLiveError(thrown as PostgrestLikeError);
  }
  return liveError("unavailable", FALLBACK_MESSAGES.unavailable, true);
}
