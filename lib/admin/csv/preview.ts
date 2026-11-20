// Shared pieces for building import previews.

import type { ImportPreview, PreviewRow, PreviewRowStatus } from "../types";

/** "Row 14, price: 11.0 is above the maximum of 10.0" */
export function cellError(rowNumber: number, column: string, problem: string): string {
  return `Row ${rowNumber}, ${column}: ${problem}`;
}

export function rowError(rowNumber: number, problem: string): string {
  return `Row ${rowNumber}: ${problem}`;
}

export function fileErrorPreview<T>(errors: string[]): ImportPreview<T> {
  return {
    fileErrors: errors,
    rows: [],
    counts: { new: 0, update: 0, unchanged: 0, error: 0 },
    canCommit: false,
  };
}

export function buildPreview<T>(rows: PreviewRow<T>[]): ImportPreview<T> {
  const counts: Record<PreviewRowStatus, number> = { new: 0, update: 0, unchanged: 0, error: 0 };
  for (const row of rows) counts[row.status] += 1;
  return {
    fileErrors: [],
    rows,
    counts,
    canCommit: counts.error === 0 && counts.new + counts.update > 0,
  };
}

/** Finalises a row: any error makes it an error row with no value. */
export function finishRow<T>(
  rowNumber: number,
  errors: string[],
  warnings: string[],
  changes: string[],
  status: Exclude<PreviewRowStatus, "error">,
  value: T,
): PreviewRow<T> {
  if (errors.length > 0) return { rowNumber, status: "error", errors, warnings, changes, value: null };
  return { rowNumber, status, errors, warnings, changes, value };
}
