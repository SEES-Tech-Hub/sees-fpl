// Owner: admin backend. The one return shape for every admin server action.
//
// It matches Bolu's ActionResult in docs/live-scores.md, so Tayo's pages handle
// admin and live-scores results the same way:
//
//   { ok: true, data }
//   { ok: false, error: { code, message, retryable, fieldErrors? } }
//
// `message` is written for the admin and is safe to show as it is (for example
// in a toast). It never contains raw SQL. `fieldErrors` maps an input field to
// its problems, for showing next to form fields. Actions never throw for
// expected failures.

import type { AdminErrorCode } from "./errors";

export type FieldErrors = Record<string, string[]>;

export type AdminError = {
  code: AdminErrorCode;
  message: string;
  /** True when trying the same request again later may work (network, busy database). */
  retryable: boolean;
  fieldErrors?: FieldErrors;
};

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: AdminError };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(
  code: AdminErrorCode,
  message: string,
  options: { retryable?: boolean; fieldErrors?: FieldErrors } = {},
): ActionResult<T> {
  const error: AdminError = { code, message, retryable: options.retryable ?? false };
  if (options.fieldErrors && Object.keys(options.fieldErrors).length > 0) {
    error.fieldErrors = options.fieldErrors;
  }
  return { ok: false, error };
}

/** Re-wraps an AdminError (for example one from mapDatabaseError) as a failed result. */
export function failWith<T = never>(error: AdminError): ActionResult<T> {
  return { ok: false, error };
}
