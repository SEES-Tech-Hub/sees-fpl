// Name normalisation shared by player matching, display names and CSV lookups.

/** Trims, collapses runs of whitespace to one space, and applies Unicode NFC. */
export function normaliseName(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

/**
 * Key for comparing names: normalised and case-insensitive. Accents are kept,
 * so "Anófi" and "Anofi" are different names.
 */
export function nameKey(value: string): string {
  return normaliseName(value).toLocaleLowerCase("en");
}
