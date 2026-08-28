import { endOfWeek, isWithinInterval, parseISO, startOfWeek } from "date-fns";
import type { Budget, CurrencyCode, ExchangeRate, Transaction } from "@/types";
import { convertToBase } from "@/lib/exchange";

export interface WeeklyBudgetUsage {
  budgetMinor: number;
  usedMinor: number;
  remainingMinor: number;
}

/** Net spend (EXPENSE + CASH_WITHDRAWAL, minus REFUND) for a transaction, in base currency. Zero for other types. */
function netSpendInBase(t: Transaction, baseCurrency: CurrencyCode, rates: ExchangeRate[]): number {
  const amount = convertToBase(t.amountMinor, t.currency, baseCurrency, rates);
  if (t.transactionType === "EXPENSE" || t.transactionType === "CASH_WITHDRAWAL") return amount;
  if (t.transactionType === "REFUND") return -amount;
  return 0;
}

/**
 * Sums every active WEEKLY budget's target and matches spend against it for
 * the current Mon-Sun week. A budget with a categoryId only counts spend in
 * that category; a budget with no category counts all spend. Deliberately
 * simple (V1): no monthly rollover, no per-category breakdown returned.
 */
export function calculateWeeklyBudgetUsage(
  transactions: Transaction[],
  budgets: Budget[],
  referenceDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): WeeklyBudgetUsage {
  const activeWeekly = budgets.filter((b) => b.active && b.period === "WEEKLY");
  const budgetMinor = activeWeekly.reduce(
    (sum, b) => sum + convertToBase(b.amountMinor, b.currency, baseCurrency, rates),
    0
  );

  const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });

  let usedMinor = 0;
  for (const b of activeWeekly) {
    for (const t of transactions) {
      if (b.categoryId && t.categoryId !== b.categoryId) continue;
      const date = parseISO(t.date);
      if (!isWithinInterval(date, { start: weekStart, end: weekEnd })) continue;
      usedMinor += netSpendInBase(t, baseCurrency, rates);
    }
  }

  return { budgetMinor, usedMinor, remainingMinor: budgetMinor - usedMinor };
}
