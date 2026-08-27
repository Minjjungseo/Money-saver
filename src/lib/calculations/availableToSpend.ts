import type {
  Account,
  AvailableHorizon,
  CurrencyCode,
  ExchangeRate,
  PlannedExpense,
  PlannedIncome,
  RecurringExpense,
} from "@/types";
import { calculateTotalBalances } from "./balances";
import { calculateConfirmedIncoming, calculateUpcomingEssentialExpenses } from "./upcoming";
import { daysRemainingInMonth, daysRemainingInWeek, getHorizonRange } from "./period";
import { convertToBase } from "@/lib/exchange";

export interface AvailableToSpendBreakdown {
  currentBalance: number;
  confirmedIncoming: number;
  upcomingEssential: number;
  reserve: number;
  availableToSpend: number;
}

/**
 * Hero calculation: what's actually free to spend right now.
 *
 * availableToSpend =
 *   included account balances
 *   + confirmed future income within the horizon
 *   - upcoming essential expenses within the horizon
 *   - reserve
 *
 * Account-to-account transfers never enter this calculation because they
 * already live inside `currentBalance` (they're not income/expense rows).
 */
export function calculateAvailableToSpend(params: {
  accounts: Account[];
  recurringExpenses: RecurringExpense[];
  plannedExpenses: PlannedExpense[];
  plannedIncomes: PlannedIncome[];
  reserveMinor: number;
  reserveCurrency: CurrencyCode;
  baseCurrency: CurrencyCode;
  rates: ExchangeRate[];
  referenceDate: Date;
  horizon: AvailableHorizon;
}): AvailableToSpendBreakdown {
  const {
    accounts,
    recurringExpenses,
    plannedExpenses,
    plannedIncomes,
    reserveMinor,
    reserveCurrency,
    baseCurrency,
    rates,
    referenceDate,
    horizon,
  } = params;

  const { start, end } = getHorizonRange(referenceDate, horizon);

  const currentBalance = calculateTotalBalances(accounts, baseCurrency, rates);
  const confirmedIncoming = calculateConfirmedIncoming(plannedIncomes, start, end, baseCurrency, rates);
  const upcomingEssential = calculateUpcomingEssentialExpenses(
    recurringExpenses,
    plannedExpenses,
    start,
    end,
    baseCurrency,
    rates
  );
  const reserve = convertToBase(reserveMinor, reserveCurrency, baseCurrency, rates);

  const availableToSpend = currentBalance + confirmedIncoming - upcomingEssential - reserve;

  return { currentBalance, confirmedIncoming, upcomingEssential, reserve, availableToSpend };
}

/** Available-to-spend divided evenly over the days remaining in the month (not a flat /4 or /30). */
export function calculateDailyAvailable(availableToSpendMinor: number, referenceDate: Date): number {
  return availableToSpendMinor / daysRemainingInMonth(referenceDate);
}

export function calculateWeeklyAvailable(availableToSpendMinor: number, referenceDate: Date): number {
  return calculateDailyAvailable(availableToSpendMinor, referenceDate) * 7;
}

/** Available-to-spend scoped to the remainder of the current calendar week (Mon-Sun), capped at month end. */
export function calculateThisWeekAvailable(availableToSpendMinor: number, referenceDate: Date): number {
  const daily = calculateDailyAvailable(availableToSpendMinor, referenceDate);
  return daily * daysRemainingInWeek(referenceDate);
}
