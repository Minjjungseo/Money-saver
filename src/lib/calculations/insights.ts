import { addMonths, isWithinInterval } from "date-fns";
import type { Category, CurrencyCode, ExchangeRate, Transaction } from "@/types";
import { calculateMonthlyExpense, calculateMonthlyIncome } from "./cashflow";
import { calculateCategoryBreakdown } from "./categoryBreakdown";
import { convertToBase } from "@/lib/exchange";
import { getMonthRange } from "./period";

export interface CategoryDelta {
  categoryId: string;
  name: string;
  currentAmountMinor: number;
  previousAmountMinor: number;
  changeMinor: number;
  changePercent: number | null; // null when previous was 0 (undefined % change)
}

export interface MonthOverMonth {
  income: number;
  expense: number;
  net: number;
  previousIncome: number;
  previousExpense: number;
  incomeChangeMinor: number;
  expenseChangeMinor: number;
  incomeChangePercent: number | null;
  expenseChangePercent: number | null;
  categoryDeltas: CategoryDelta[];
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function calculateMonthOverMonth(
  transactions: Transaction[],
  categories: Category[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): MonthOverMonth {
  const previousMonth = addMonths(monthDate, -1);

  const income = calculateMonthlyIncome(transactions, monthDate, baseCurrency, rates);
  const expense = calculateMonthlyExpense(transactions, monthDate, baseCurrency, rates);
  const previousIncome = calculateMonthlyIncome(transactions, previousMonth, baseCurrency, rates);
  const previousExpense = calculateMonthlyExpense(transactions, previousMonth, baseCurrency, rates);

  const current = calculateCategoryBreakdown(transactions, categories, monthDate, baseCurrency, rates);
  const previous = calculateCategoryBreakdown(transactions, categories, previousMonth, baseCurrency, rates);
  const previousById = new Map(previous.map((p) => [p.categoryId, p.amountMinor]));
  const allCategoryIds = new Set([...current.map((c) => c.categoryId), ...previous.map((p) => p.categoryId)]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const categoryDeltas: CategoryDelta[] = Array.from(allCategoryIds).map((categoryId) => {
    const currentAmountMinor = current.find((c) => c.categoryId === categoryId)?.amountMinor ?? 0;
    const previousAmountMinor = previousById.get(categoryId) ?? 0;
    return {
      categoryId,
      name: categoryById.get(categoryId)?.name ?? "Other",
      currentAmountMinor,
      previousAmountMinor,
      changeMinor: currentAmountMinor - previousAmountMinor,
      changePercent: pctChange(currentAmountMinor, previousAmountMinor),
    };
  });
  categoryDeltas.sort((a, b) => Math.abs(b.changeMinor) - Math.abs(a.changeMinor));

  return {
    income,
    expense,
    net: income - expense,
    previousIncome,
    previousExpense,
    incomeChangeMinor: income - previousIncome,
    expenseChangeMinor: expense - previousExpense,
    incomeChangePercent: pctChange(income, previousIncome),
    expenseChangePercent: pctChange(expense, previousExpense),
    categoryDeltas,
  };
}

export interface BiggestTransaction {
  transaction: Transaction;
  amountInBase: number;
}

export function calculateBiggestTransactions(
  transactions: Transaction[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[],
  limit = 5
): BiggestTransaction[] {
  const { start, end } = getMonthRange(monthDate);

  return transactions
    .filter((tx) => tx.transactionType === "EXPENSE")
    .filter((tx) => isWithinInterval(new Date(`${tx.date}T00:00:00`), { start, end }))
    .map((tx) => ({ transaction: tx, amountInBase: convertToBase(tx.amountMinor, tx.currency, baseCurrency, rates) }))
    .sort((a, b) => b.amountInBase - a.amountInBase)
    .slice(0, limit);
}
