import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";
import type { WeeklyBudgetUsage } from "@/lib/calculations/budget";
import { cn } from "@/lib/cn";

/** Only rendered when at least one active weekly budget exists — no clutter otherwise. */
export function WeeklyBudgetCard({ usage, currency }: { usage: WeeklyBudgetUsage; currency: CurrencyCode }) {
  const overBudget = usage.remainingMinor < 0;

  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>이번 주 생활비</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-ink-muted">사용</span>
          <span className="tabular-nums text-[15px] font-medium text-ink">
            {formatMoney(usage.usedMinor, currency)} / {formatMoney(usage.budgetMinor, currency)}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
          <div
            className={cn("h-full rounded-full", overBudget ? "bg-negative" : "bg-accent")}
            style={{ width: `${Math.min(100, usage.budgetMinor > 0 ? (usage.usedMinor / usage.budgetMinor) * 100 : 0)}%` }}
          />
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="text-[13px] text-ink-muted">남은 생활비</span>
          <span className={cn("tabular-nums text-[15px] font-semibold", overBudget ? "text-negative" : "text-ink")}>
            {formatMoney(usage.remainingMinor, currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
