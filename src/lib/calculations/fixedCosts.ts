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
  /** The active "생활비" budget's monthly-equivalent target, converted into baseCurrency; null if none is configured. */
  monthlyBudgetMinor: number | null;
  /** monthlyBudgetMinor - includedTotalBaseMinor; null when there's no monthly budget to compare against. */
  variableRemainingMinor: number | null;
}

/** Weeks per month, averaged (52 weeks / 12 months) — the standard weekly<->monthly budget conversion. */
const WEEKS_PER_MONTH = 52 / 12;

/** The stable name the living-budget editor always saves under, so it can be found regardless of its WEEKLY/MONTHLY basis. */
export const LIVING_BUDGET_NAME = "생활비";

/** Finds the active "생활비" budget and expresses its target as a monthly-equivalent amount in baseCurrency. */
export function resolveMonthlyLivingBudgetMinor(
  budgets: Budget[],
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number | null {
  const livingBudget = budgets.find((b) => b.active && b.name === LIVING_BUDGET_NAME);
  if (!livingBudget) return null;
  const monthlyMinor =
    livingBudget.period === "WEEKLY" ? Math.round(livingBudget.amountMinor * WEEKS_PER_MONTH) : livingBudget.amountMinor;
  return convertToBase(monthlyMinor, livingBudget.currency, baseCurrency, rates);
}

/**
 * Rolls up recurring expenses into a monthly fixed-cost picture: how much of
 * the household's regular living budget is already committed ("생활비 포함"
 * items) versus how much is left for variable day-to-day spending, with rent
 * and other "생활비 별도" items tracked apart since they're funded separately.
 * Uses each item's `monthlyEquivalentMinor` when set (its real cycle isn't
 * monthly), falling back to `amountMinor`; items with neither confirmed
 * contribute 0 rather than being guessed.
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
    (sum, r) => sum + convertToBase(monthlyBudgetFigure(r), r.currency, baseCurrency, rates),
    0
  );

  const monthlyBudgetMinor = resolveMonthlyLivingBudgetMinor(budgets, baseCurrency, rates);

  return {
    includedByCurrency,
    separateByCurrency,
    includedTotalBaseMinor,
    baseCurrency,
    monthlyBudgetMinor,
    variableRemainingMinor: monthlyBudgetMinor === null ? null : monthlyBudgetMinor - includedTotalBaseMinor,
  };
}

/** The best available monthly-budget figure for an item: its explicit monthly-equivalent, else its real amount, else 0 (never guessed). */
function monthlyBudgetFigure(r: RecurringExpense): number {
  return r.monthlyEquivalentMinor ?? r.amountMinor ?? 0;
}

function sumByCurrency(items: RecurringExpense[]): Partial<Record<CurrencyCode, number>> {
  const totals: Partial<Record<CurrencyCode, number>> = {};
  for (const item of items) {
    totals[item.currency] = (totals[item.currency] ?? 0) + monthlyBudgetFigure(item);
  }
  return totals;
}
