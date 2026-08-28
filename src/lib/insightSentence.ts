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
    return "이번 달에는 아직 지출 내역이 없어요.";
  }

  const diff = Math.abs(mom.expenseChangeMinor);
  const direction = mom.expenseChangeMinor > 0 ? "더" : "덜";

  let sentence: string;
  if (mom.expenseChangeMinor === 0) {
    sentence = "이번 달 지출은 지난달과 비슷해요.";
  } else {
    sentence = `이번 달에는 지난달보다 ${formatMoney(diff, currency)} ${direction} 사용했어요.`;
  }

  const biggestMover = mom.categoryDeltas.find((c) => c.changeMinor !== 0);
  if (biggestMover) {
    const moverDirection = biggestMover.changeMinor > 0 ? "늘어난" : "줄어든";
    sentence += ` 가장 크게 ${moverDirection} 항목은 ${biggestMover.name}이에요.`;
  }

  return sentence;
}
