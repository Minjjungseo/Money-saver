import { isWithinInterval, parseISO } from "date-fns";
import type {
  CurrencyCode,
  ExchangeRate,
  PlannedExpense,
  PlannedIncome,
  RecurringExpense,
} from "@/types";
import { convertToBase } from "@/lib/exchange";
import { expandRecurringOccurrences } from "./recurring";

/** Essential recurring expenses + essential planned expenses due within the horizon. */
export function calculateUpcomingEssentialExpenses(
  recurringExpenses: RecurringExpense[],
  plannedExpenses: PlannedExpense[],
  horizonStart: Date,
  horizonEnd: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  let total = 0;
  for (const r of recurringExpenses.filter((r) => r.essential)) {
    const occurrences = expandRecurringOccurrences(r, horizonStart, horizonEnd);
    total += occurrences.length * convertToBase(r.amountMinor, r.currency, baseCurrency, rates);
  }
  for (const p of plannedExpenses.filter((p) => p.essential && p.status === "PLANNED")) {
    const date = parseISO(p.date);
    if (isWithinInterval(date, { start: horizonStart, end: horizonEnd })) {
      total += convertToBase(p.expectedAmountMinor, p.currency, baseCurrency, rates);
    }
  }
  return total;
}

/** Confirmed (not estimated) planned income arriving within the horizon. */
export function calculateConfirmedIncoming(
  plannedIncomes: PlannedIncome[],
  horizonStart: Date,
  horizonEnd: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  return plannedIncomes
    .filter((p) => p.confirmed)
    .filter((p) => isWithinInterval(parseISO(p.expectedDate), { start: horizonStart, end: horizonEnd }))
    .reduce((sum, p) => sum + convertToBase(p.amountMinor, p.currency, baseCurrency, rates), 0);
}

export interface UpcomingItem {
  date: string;
  name: string;
  amountMinor: number;
  currency: CurrencyCode;
  essential: boolean;
  kind: "RECURRING" | "PLANNED_EXPENSE";
}

/** Flat, date-sorted list of upcoming outflows for the HOME "Upcoming" section. */
export function calculateUpcomingItems(
  recurringExpenses: RecurringExpense[],
  plannedExpenses: PlannedExpense[],
  horizonStart: Date,
  horizonEnd: Date,
  limit = 8
): UpcomingItem[] {
  const items: UpcomingItem[] = [];
  for (const r of recurringExpenses) {
    for (const date of expandRecurringOccurrences(r, horizonStart, horizonEnd)) {
      items.push({
        date: date.toISOString().slice(0, 10),
        name: r.name,
        amountMinor: r.amountMinor,
        currency: r.currency,
        essential: r.essential,
        kind: "RECURRING",
      });
    }
  }
  for (const p of plannedExpenses.filter((p) => p.status === "PLANNED")) {
    const date = parseISO(p.date);
    if (isWithinInterval(date, { start: horizonStart, end: horizonEnd })) {
      items.push({
        date: p.date,
        name: p.name,
        amountMinor: p.expectedAmountMinor,
        currency: p.currency,
        essential: p.essential,
        kind: "PLANNED_EXPENSE",
      });
    }
  }
  return items.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, limit);
}
