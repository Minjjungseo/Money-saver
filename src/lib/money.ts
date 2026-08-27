import type { CurrencyCode } from "@/types";

/** Minor units per 1 major unit, per currency. KRW has no practical subunit. */
export const MINOR_UNIT_SCALE: Record<CurrencyCode, number> = {
  AUD: 100,
  KRW: 1,
};

export const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  AUD: "A$",
  KRW: "₩",
};

/** Convert a user-entered major-unit amount (e.g. "84.53") to minor units (8453). */
export function toMinorUnits(majorAmount: number, currency: CurrencyCode): number {
  return Math.round(majorAmount * MINOR_UNIT_SCALE[currency]);
}

/** Convert minor units back to a major-unit float, for editing/export. */
export function toMajorUnits(minorAmount: number, currency: CurrencyCode): number {
  return minorAmount / MINOR_UNIT_SCALE[currency];
}

/** Format minor units as a display string, e.g. "A$84.53" or "₩3,200,000". */
export function formatMoney(
  minorAmount: number,
  currency: CurrencyCode,
  opts: { showSign?: boolean; compact?: boolean } = {}
): string {
  const major = toMajorUnits(Math.abs(minorAmount), currency);
  const fractionDigits = MINOR_UNIT_SCALE[currency] === 1 ? 0 : 2;
  const formatted = new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: opts.compact ? 0 : fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(major);
  const sign = minorAmount < 0 ? "-" : opts.showSign && minorAmount > 0 ? "+" : "";
  return `${sign}${CURRENCY_SYMBOL[currency]}${formatted}`;
}

/**
 * Convert an amount in minor units from one currency to another using a direct
 * AUD<->KRW rate (1 AUD = rate KRW). Returns minor units in `toCurrency`.
 */
export function convertMinor(
  amountMinor: number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  audKrwRate: number
): number {
  if (fromCurrency === toCurrency) return amountMinor;
  const fromMajor = toMajorUnits(amountMinor, fromCurrency);
  const toMajor =
    fromCurrency === "AUD" ? fromMajor * audKrwRate : fromMajor / audKrwRate;
  return toMinorUnits(toMajor, toCurrency);
}
