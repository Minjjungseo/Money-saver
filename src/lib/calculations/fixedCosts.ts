import type { Budget, CurrencyCode, ExchangeRate, RecurringExpense } from "@/types";
import { convertToBase } from "@/lib/exchange";

export interface FixedCostSummary {
  /** INCLUDED items' subtotal per currency they're actually billed in (no FX applied). */
  includedByCurrency: Partial<Record<CurrencyCode, number>>;
  /** SEPARATE items' subtotal per currency (e.g. rent), not counted toward the living budget. */
  separateByCurrency: Partial<Record<CurrencyCode, number>>;
  /** All INCLUDED items converted into baseCurrency and summed. */
  includedTotalBaseMinor: number;
  baseCurrency: CurrencyCode;
  /** Target from the active MONTHLY budget, converted into baseCurrency; null if none is configured. */
  monthlyBudgetMinor: number | null;
  /** monthlyBudgetMinor - includedTotalBaseMinor; null when there's no monthly budget to compare against. */
  variableRemainingMinor: number | null;
}

/**
 * Rolls up recurring expenses into a monthly fixed-cost picture: how much of
 * the household's regular living budget is already committed ("생활비 포함"
 * items) versus how much is left for variable day-to-day spending, with rent
 * and other "생활비 별도" items tracked apart since they're funded separately.
 */
export function calculateFixedCostSummary(
  recurringExpenses: RecurringExpense[],
  budgets: Budget[],
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): FixedCostSummary {
  const included = recurringExpenses.filter((r) => r.livingBudgetImpact === "INCLUDED");
  const separate = recurringExpenses.filter((r) => r.livingBudgetImpact === "SEPARATE");

  const includedByCurrency = sumByCurrency(included);
  const separateByCurrency = sumByCurrency(separate);

  const includedTotalBaseMinor = included.reduce(
    (sum, r) => sum + convertToBase(r.amountMinor, r.currency, baseCurrency, rates),
    0
  );

  const activeMonthlyBudget = budgets.find((b) => b.active && b.period === "MONTHLY");
  const monthlyBudgetMinor = activeMonthlyBudget
    ? convertToBase(activeMonthlyBudget.amountMinor, activeMonthlyBudget.currency, baseCurrency, rates)
    : null;

  return {
    includedByCurrency,
    separateByCurrency,
    includedTotalBaseMinor,
    baseCurrency,
    monthlyBudgetMinor,
    variableRemainingMinor: monthlyBudgetMinor === null ? null : monthlyBudgetMinor - includedTotalBaseMinor,
  };
}

function sumByCurrency(items: RecurringExpense[]): Partial<Record<CurrencyCode, number>> {
  const totals: Partial<Record<CurrencyCode, number>> = {};
  for (const item of items) {
    totals[item.currency] = (totals[item.currency] ?? 0) + item.amountMinor;
  }
  return totals;
}
