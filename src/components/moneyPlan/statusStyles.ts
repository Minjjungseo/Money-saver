import type { MoneyPlanBucketResult } from "@/lib/calculations/moneyPlan";

export const MONEY_PLAN_STATUS_LABEL: Record<MoneyPlanBucketResult["status"], string> = {
  SUFFICIENT: "충분",
  SHORT: "부족",
  NEEDS_ACCOUNT: "확인 필요",
};

export const MONEY_PLAN_STATUS_TONE: Record<MoneyPlanBucketResult["status"], "accent" | "negative" | "warn"> = {
  SUFFICIENT: "accent",
  SHORT: "negative",
  NEEDS_ACCOUNT: "warn",
};
