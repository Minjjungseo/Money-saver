import { isWithinInterval } from "date-fns";
import type { CurrencyCode, ExchangeRate, Transaction } from "@/types";
import { convertToBase } from "@/lib/exchange";
import { getMonthRange } from "./period";

function parseTxDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function inMonth(tx: Transaction, monthDate: Date): boolean {
  const { start, end } = getMonthRange(monthDate);
  return isWithinInterval(parseTxDate(tx.date), { start, end });
}

/**
 * Monthly income: confirmed money actually received this month. REFUND is
 * treated as reducing the related expense (see calculateMonthlyExpense),
 * not as fresh income, so it is intentionally excluded here.
 */
export function calculateMonthlyIncome(
  transactions: Transaction[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  return transactions
    .filter((tx) => tx.transactionType === "INCOME" && inMonth(tx, monthDate))
    .reduce((sum, tx) => sum + convertToBase(tx.amountMinor, tx.currency, baseCurrency, rates), 0);
}

/**
 * Monthly expense: spending outflow. CASH_WITHDRAWAL counts as an outflow
 * (cash leaving the tracked account); REFUND offsets it since it reverses a
 * prior purchase rather than being new income. TRANSFER/EXCHANGE are always
 * excluded from cash flow per the product spec.
 */
export function calculateMonthlyExpense(
  transactions: Transaction[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  return transactions
    .filter((tx) => inMonth(tx, monthDate))
    .reduce((sum, tx) => {
      const amount = convertToBase(tx.amountMinor, tx.currency, baseCurrency, rates);
      if (tx.transactionType === "EXPENSE" || tx.transactionType === "CASH_WITHDRAWAL") {
        return sum + amount;
      }
      if (tx.transactionType === "REFUND") {
        return sum - amount;
      }
      return sum;
    }, 0);
}

export function calculateNetCashFlow(
  transactions: Transaction[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  return (
    calculateMonthlyIncome(transactions, monthDate, baseCurrency, rates) -
    calculateMonthlyExpense(transactions, monthDate, baseCurrency, rates)
  );
}

export interface MonthlyTrendPoint {
  monthKey: string; // yyyy-MM
  label: string; // "8월"
  income: number;
  expense: number;
}

export function calculateMonthlyTrend(
  transactions: Transaction[],
  referenceDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[],
  monthsBack = 5
): MonthlyTrendPoint[] {
  const points: MonthlyTrendPoint[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const monthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    points.push({
      monthKey: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      label: `${monthDate.getMonth() + 1}월`,
      income: calculateMonthlyIncome(transactions, monthDate, baseCurrency, rates),
      expense: calculateMonthlyExpense(transactions, monthDate, baseCurrency, rates),
    });
  }
  return points;
}
