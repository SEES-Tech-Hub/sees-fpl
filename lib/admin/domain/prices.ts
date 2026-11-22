// Player prices. Stored as tenths of a million naira (55 = N5.5m), the same as
// players.price_tenths and the fantasy contract.
//
// The allowed range and step are never written here. From PR 3 they come from the
// database function admin_price_rules() and are passed in as PriceRules.

export type PriceRules = {
  minTenths: number;
  maxTenths: number;
  stepTenths: number;
};

/** "5.5" (no currency), for CSV files and inputs. */
export function formatPriceNumber(tenths: number): string {
  return (tenths / 10).toFixed(1);
}

/** "₦5.5m", for messages and display. */
export function formatPrice(tenths: number): string {
  return `₦${formatPriceNumber(tenths)}m`;
}

export type ParsedPrice = { ok: true; tenths: number } | { ok: false; message: string };

/**
 * Parses a price typed in naira millions: "5.5", "5", "₦5.5m", "N5.5m", "5.5m".
 * Works on the decimal text, not floats, so "5.25" is caught rather than rounded.
 */
export function parsePrice(raw: string, rules: PriceRules): ParsedPrice {
  const text = raw.trim();
  if (text === "") return { ok: false, message: "is missing" };

  const match = text.match(/^(?:₦|N|n)?\s*(\d{1,3})(?:\.(\d+))?\s*(?:m|M)?$/);
  if (!match) {
    return { ok: false, message: `"${text}" isn't a price. Write it in millions, like 5.5` };
  }
  const whole = Number(match[1]);
  const fraction = (match[2] ?? "").replace(/0+$/, "");
  if (fraction.length > 1) {
    return {
      ok: false,
      message: `${text} isn't a step of ${formatPriceNumber(rules.stepTenths)}`,
    };
  }
  const tenths = whole * 10 + (fraction === "" ? 0 : Number(fraction));
  const problem = checkPriceTenths(tenths, rules);
  return problem ? { ok: false, message: problem } : { ok: true, tenths };
}

/** A plain-words problem with the price, or null if it's allowed. */
export function checkPriceTenths(tenths: number, rules: PriceRules): string | null {
  if (!Number.isInteger(tenths)) {
    return `${tenths / 10} isn't a step of ${formatPriceNumber(rules.stepTenths)}`;
  }
  if (tenths < rules.minTenths) {
    return `${formatPriceNumber(tenths)} is below the minimum of ${formatPriceNumber(rules.minTenths)}`;
  }
  if (tenths > rules.maxTenths) {
    return `${formatPriceNumber(tenths)} is above the maximum of ${formatPriceNumber(rules.maxTenths)}`;
  }
  if ((tenths - rules.minTenths) % rules.stepTenths !== 0) {
    return `${formatPriceNumber(tenths)} isn't a step of ${formatPriceNumber(rules.stepTenths)}`;
  }
  return null;
}

/**
 * Prices lock at matchday 1's deadline. A null deadline means no lock (the
 * deadline isn't set yet). The database trigger is the real gate; this is for
 * previews and disabling inputs.
 */
export function isPriceLocked(matchday1DeadlineAt: string | null, now: Date): boolean {
  if (!matchday1DeadlineAt) return false;
  return new Date(matchday1DeadlineAt).getTime() <= now.getTime();
}

/** Late additions (after the lock) join at the lowest allowed price. */
export function lateAdditionPrice(rules: PriceRules): number {
  return rules.minTenths;
}
