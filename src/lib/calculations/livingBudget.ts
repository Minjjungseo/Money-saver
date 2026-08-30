import { isWithinInterval, subMonths } from "date-fns";
import type { Category, CurrencyCode, ExchangeRate, Transaction } from "@/types";
import { convertToBase } from "@/lib/exchange";
import { resolveExpenseScope, resolveExpenseBehavior, homeSpendBucketFor, HOME_SPEND_BUCKET_LABELS, type HomeSpendBucket } from "@/lib/expenseClassification";
import { getMonthRange } from "./period";

function parseTxDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** Net spend (EXPENSE + CASH_WITHDRAWAL, minus REFUND) in base currency; zero for INCOME/TRANSFER/EXCHANGE. */
function netSpendInBase(t: Transaction, baseCurrency: CurrencyCode, rates: ExchangeRate[]): number {
  const amount = convertToBase(t.amountMinor, t.currency, baseCurrency, rates);
  if (t.transactionType === "EXPENSE" || t.transactionType === "CASH_WITHDRAWAL") return amount;
  if (t.transactionType === "REFUND") return -amount;
  return 0;
}

export interface ExpenseTotals {
  /** HOUSEHOLD scope, FIXED behavior — the household's recurring fixed costs (rent excluded; rent is SEPARATE). */
  householdFixedMinor: number;
  /** HOUSEHOLD scope, VARIABLE or ONE_TIME behavior — day-to-day living spend. */
  householdVariableMinor: number;
  /** BUSINESS scope, any behavior. */
  businessMinor: number;
  /** SEPARATE scope, any behavior (rent, tuition, large one-off funded items). */
  separateMinor: number;
}

const EMPTY_TOTALS: ExpenseTotals = { householdFixedMinor: 0, householdVariableMinor: 0, businessMinor: 0, separateMinor: 0 };

/** Net monthly spend grouped by ExpenseScope × ExpenseBehavior (explicit tags, else inferred from category/merchant). */
export function calculateExpenseTotals(
  transactions: Transaction[],
  categories: Category[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): ExpenseTotals {
  const { start, end } = getMonthRange(monthDate);
  const totals = { ...EMPTY_TOTALS };
  for (const t of transactions) {
    if (!isWithinInterval(parseTxDate(t.date), { start, end })) continue;
    const scope = resolveExpenseScope(t, categories);
    const amount = netSpendInBase(t, baseCurrency, rates);
    if (scope === "BUSINESS") {
      totals.businessMinor += amount;
    } else if (scope === "SEPARATE") {
      totals.separateMinor += amount;
    } else if (scope === "HOUSEHOLD") {
      const behavior = resolveExpenseBehavior(t, categories);
      if (behavior === "FIXED") totals.householdFixedMinor += amount;
      else totals.householdVariableMinor += amount;
    }
    // TRANSFER scope is excluded from every bucket — it's not spend.
  }
  return totals;
}

export interface LivingSpendBucketItem {
  bucket: HomeSpendBucket;
  label: string;
  amountMinor: number;
  percentage: number;
  prevAmountMinor: number;
  deltaMinor: number;
}

/**
 * HOUSEHOLD/VARIABLE spend for the month, grouped into the 7 simplified
 * Home-screen buckets and ranked descending, with each bucket's prior-month
 * amount for a small "지난달보다 +/-" comparison. FIXED/BUSINESS/SEPARATE/TRANSFER
 * spend is intentionally excluded — this answers "어디에 생활비를 많이 썼는가",
 * not total spend.
 */
export function calculateLivingSpendByBucket(
  transactions: Transaction[],
  categories: Category[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): LivingSpendBucketItem[] {
  const bucketTotalsFor = (month: Date): Partial<Record<HomeSpendBucket, number>> => {
    const { start, end } = getMonthRange(month);
    const totals: Partial<Record<HomeSpendBucket, number>> = {};
    for (const t of transactions) {
      if (!isWithinInterval(parseTxDate(t.date), { start, end })) continue;
      if (resolveExpenseScope(t, categories) !== "HOUSEHOLD") continue;
      if (resolveExpenseBehavior(t, categories) !== "VARIABLE") continue;
      const bucket = homeSpendBucketFor(t.categoryId, categories);
      totals[bucket] = (totals[bucket] ?? 0) + netSpendInBase(t, baseCurrency, rates);
    }
    return totals;
  };

  const current = bucketTotalsFor(monthDate);
  const previous = bucketTotalsFor(subMonths(monthDate, 1));

  const grandTotal = Object.values(current)
    .filter((v) => v > 0)
    .reduce((a, b) => a + b, 0);

  return (Object.entries(current) as [HomeSpendBucket, number][])
    .filter(([, amountMinor]) => amountMinor > 0)
    .map(([bucket, amountMinor]) => {
      const prevAmountMinor = previous[bucket] ?? 0;
      return {
        bucket,
        label: HOME_SPEND_BUCKET_LABELS[bucket],
        amountMinor,
        percentage: grandTotal > 0 ? (amountMinor / grandTotal) * 100 : 0,
        prevAmountMinor,
        deltaMinor: amountMinor - prevAmountMinor,
      };
    })
    .sort((a, b) => b.amountMinor - a.amountMinor);
}
