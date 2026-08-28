import type { Account, PlannedIncome, PlannedExpense, RecurringExpense, Settings } from "@/types";

export type ReadinessReason =
  | "ACCOUNT_BALANCE_UNCONFIRMED"
  | "NO_ESSENTIAL_EXPENSE"
  | "NO_PLANNED_INCOME"
  | "RESERVE_NOT_SET";

export interface AvailableToSpendReadiness {
  ready: boolean;
  missing: ReadinessReason[];
}

/**
 * Gates whether the Available-to-Spend hero number should be presented as a
 * trustworthy figure. The number itself always computes (see
 * calculateAvailableToSpend) — this only decides whether the UI should show
 * it with confidence or flag it as still being set up.
 */
export function calculateAvailableToSpendReadiness(params: {
  accounts: Account[];
  recurringExpenses: RecurringExpense[];
  plannedExpenses: PlannedExpense[];
  plannedIncomes: PlannedIncome[];
  settings: Settings;
}): AvailableToSpendReadiness {
  const { accounts, recurringExpenses, plannedExpenses, plannedIncomes, settings } = params;
  const missing: ReadinessReason[] = [];

  const hasUnconfirmedIncludedBalance = accounts.some(
    (a) => a.includeInAvailable && !a.balanceAsOfDate
  );
  if (hasUnconfirmedIncludedBalance) missing.push("ACCOUNT_BALANCE_UNCONFIRMED");

  const hasEssentialExpense =
    recurringExpenses.some((r) => r.essential) ||
    plannedExpenses.some((p) => p.essential && p.status === "PLANNED");
  if (!hasEssentialExpense) missing.push("NO_ESSENTIAL_EXPENSE");

  if (plannedIncomes.length === 0) missing.push("NO_PLANNED_INCOME");

  if (!settings.reserveConfirmed) missing.push("RESERVE_NOT_SET");

  return { ready: missing.length === 0, missing };
}
