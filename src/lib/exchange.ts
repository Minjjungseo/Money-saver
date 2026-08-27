import type { CurrencyCode, ExchangeRate } from "@/types";
import { convertMinor } from "@/lib/money";

/** Looks up the AUD<->KRW rate (1 AUD = rate KRW) from stored rates, with a safe fallback. */
export function getAudKrwRate(rates: ExchangeRate[]): number {
  return rates.find((r) => r.pair === "AUD_KRW")?.rate ?? 900;
}

/** Converts a minor-unit amount into the base currency for cross-currency aggregation. */
export function convertToBase(
  amountMinor: number,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  return convertMinor(amountMinor, currency, baseCurrency, getAudKrwRate(rates));
}
