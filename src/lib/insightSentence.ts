import type { MonthOverMonth } from "@/lib/calculations/insights";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";

/**
 * Builds a plain-language summary sentence strictly from already-computed
 * numbers (no free-form generation) so it can never state a figure that
 * doesn't trace back to a real calculation.
 */
export function generateInsightSentence(mom: MonthOverMonth, currency: CurrencyCode): string {
  if (mom.expense === 0 && mom.previousExpense === 0) {
    return "No spending recorded yet this month.";
  }

  const diff = Math.abs(mom.expenseChangeMinor);
  const direction = mom.expenseChangeMinor > 0 ? "increased" : mom.expenseChangeMinor < 0 ? "decreased" : "stayed flat";

  let sentence: string;
  if (mom.expenseChangeMinor === 0) {
    sentence = "This month's spending is on par with last month.";
  } else {
    sentence = `This month's spending ${direction} by ${formatMoney(diff, currency)} compared to last month.`;
  }

  const biggestMover = mom.categoryDeltas.find((c) => c.changeMinor !== 0);
  if (biggestMover) {
    const moverDirection = biggestMover.changeMinor > 0 ? "increase" : "decrease";
    sentence += ` The biggest ${moverDirection} was in ${biggestMover.name}.`;
  }

  return sentence;
}
