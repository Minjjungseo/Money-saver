import type { Budget } from "@/types";
import { toMinorUnits } from "@/lib/money";
import { generateId, nowIso } from "@/lib/id";
import { LIVING_BUDGET_NAME } from "@/lib/calculations/fixedCosts";

/**
 * Creates the default weekly "생활비" budget (장보기170/외식·카페70/쇼핑·아이40/교통·기타20,
 * A$300/주) ONLY if no active budget named "생활비" already exists. If the
 * user already has one — whether untouched or already edited — it is left
 * completely alone; this never resets or overwrites a person's own values.
 */
export function ensureDefaultLivingBudget(budgets: Budget[]): { budgets: Budget[]; created: boolean } {
  const existing = budgets.find((b) => b.active && b.name === LIVING_BUDGET_NAME);
  if (existing) return { budgets, created: false };

  const defaultBudget: Budget = {
    id: generateId("budget"),
    name: LIVING_BUDGET_NAME,
    amountMinor: toMinorUnits(300, "AUD"),
    currency: "AUD",
    period: "WEEKLY",
    categoryId: null,
    active: true,
    subItems: [
      { name: "장보기", amountMinor: toMinorUnits(170, "AUD") },
      { name: "외식·카페", amountMinor: toMinorUnits(70, "AUD") },
      { name: "쇼핑·아이", amountMinor: toMinorUnits(40, "AUD") },
      { name: "교통·기타", amountMinor: toMinorUnits(20, "AUD") },
    ],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  return { budgets: [...budgets, defaultBudget], created: true };
}
