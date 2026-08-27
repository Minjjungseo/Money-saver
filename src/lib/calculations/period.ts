import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, startOfDay, startOfMonth } from "date-fns";
import type { AvailableHorizon } from "@/types";

export function getMonthRange(monthDate: Date): { start: Date; end: Date } {
  return { start: startOfMonth(monthDate), end: endOfMonth(monthDate) };
}

/** Days remaining in the month, counting today. Minimum of 1 to avoid divide-by-zero. */
export function daysRemainingInMonth(referenceDate: Date): number {
  const end = endOfMonth(referenceDate);
  return Math.max(1, differenceInCalendarDays(end, referenceDate) + 1);
}

/** Days remaining in the current week (Mon-Sun), counting today, capped by month end. */
export function daysRemainingInWeek(referenceDate: Date): number {
  const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
  const monthEnd = endOfMonth(referenceDate);
  const boundary = weekEnd < monthEnd ? weekEnd : monthEnd;
  return Math.max(1, differenceInCalendarDays(boundary, referenceDate) + 1);
}

/**
 * The forward-looking window used for "Available to Spend": from today through
 * the chosen horizon. V1 defaults to end of the current month; 30/90-day and
 * custom-date horizons are wired up for later without changing call sites.
 */
export function getHorizonRange(
  referenceDate: Date,
  horizon: AvailableHorizon
): { start: Date; end: Date } {
  // Normalized to midnight: dates on transactions/recurring/planned items are
  // date-only (a whole day), so "today" must include all of today regardless
  // of the current time-of-day, not just the instant this function runs.
  const start = startOfDay(referenceDate);
  switch (horizon) {
    case "30_DAYS":
      return { start, end: addDays(start, 30) };
    case "90_DAYS":
      return { start, end: addDays(start, 90) };
    case "END_OF_MONTH":
    default:
      return { start, end: endOfMonth(referenceDate) };
  }
}
