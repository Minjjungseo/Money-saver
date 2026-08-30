import { addDays, addMonths, addWeeks, parseISO } from "date-fns";
import type { RecurringExpense } from "@/types";

function advance(date: Date, recurring: RecurringExpense): Date {
  switch (recurring.frequency) {
    case "WEEKLY":
      return addWeeks(date, 1);
    case "FORTNIGHTLY":
      return addWeeks(date, 2);
    case "MONTHLY":
      return addMonths(date, 1);
    case "QUARTERLY":
      return addMonths(date, 3);
    case "SIX_MONTHLY":
      return addMonths(date, 6);
    case "YEARLY":
      return addMonths(date, 12);
    case "CUSTOM": {
      const interval = recurring.customInterval ?? { unit: "MONTH", count: 1 };
      return interval.unit === "WEEK" ? addWeeks(date, interval.count) : addMonths(date, interval.count);
    }
    case "TERM_BASED":
      // No fixed advance rule — the caller stops after the single confirmed date.
      return date;
  }
}

const MAX_ITERATIONS = 2000;

/**
 * Expands a recurring expense into concrete occurrence dates that fall within
 * [rangeStart, rangeEnd]. Walks forward from nextDueDate one period at a time
 * (bounded) so a stale nextDueDate in the past still lines up correctly.
 *
 * Returns [] when nextDueDate is null (not yet confirmed) — never guesses a
 * date. TERM_BASED items yield at most their single confirmed nextDueDate,
 * since a term's real next billing date can't be projected by a fixed rule.
 */
export function expandRecurringOccurrences(
  recurring: RecurringExpense,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (!recurring.nextDueDate) return [];

  const occurrences: Date[] = [];
  const endLimit = recurring.endDate ? parseISO(recurring.endDate) : null;
  let cursor = parseISO(recurring.nextDueDate);
  let iterations = 0;

  while (cursor <= rangeEnd && iterations < MAX_ITERATIONS) {
    iterations++;
    if (endLimit && cursor > endLimit) break;
    if (cursor >= rangeStart) {
      occurrences.push(cursor);
    }
    if (recurring.frequency === "TERM_BASED") break;
    cursor = advance(cursor, recurring);
  }
  return occurrences;
}

/** Next single occurrence on/after `from`, or null if the series has ended. */
export function nextOccurrenceOnOrAfter(
  recurring: RecurringExpense,
  from: Date
): Date | null {
  const farFuture = addDays(from, 366 * 2);
  const occurrences = expandRecurringOccurrences(recurring, from, farFuture);
  return occurrences[0] ?? null;
}
