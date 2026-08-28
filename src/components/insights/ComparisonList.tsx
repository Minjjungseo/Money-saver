import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";
import type { CategoryDelta } from "@/lib/calculations/insights";
import { cn } from "@/lib/cn";

function ChangeBadge({ percent, changeMinor, inverse }: { percent: number | null; changeMinor: number; inverse?: boolean }) {
  if (changeMinor === 0) {
    return (
      <span className="flex items-center gap-0.5 text-[13px] font-medium text-ink-faint">
        <Minus size={13} /> 0%
      </span>
    );
  }
  const isIncrease = changeMinor > 0;
  // For expense/spend metrics, an increase is "bad" (negative tone) unless inverse (income) is set.
  const isGood = inverse ? isIncrease : !isIncrease;
  return (
    <span className={cn("flex items-center gap-0.5 text-[13px] font-medium", isGood ? "text-accent" : "text-negative")}>
      {isIncrease ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {percent === null ? "신규" : `${Math.abs(percent).toFixed(0)}%`}
    </span>
  );
}

export function ComparisonList({
  income,
  expense,
  incomeChangePercent,
  expenseChangePercent,
  incomeChangeMinor,
  expenseChangeMinor,
  categoryDeltas,
  currency,
}: {
  income: number;
  expense: number;
  incomeChangePercent: number | null;
  expenseChangePercent: number | null;
  incomeChangeMinor: number;
  expenseChangeMinor: number;
  categoryDeltas: CategoryDelta[];
  currency: CurrencyCode;
}) {
  const topDeltas = categoryDeltas.filter((c) => c.changeMinor !== 0).slice(0, 5);

  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>지난달과 비교</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex flex-col divide-y divide-border">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">수입</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-[14px] text-ink-muted">{formatMoney(income, currency)}</span>
              <ChangeBadge percent={incomeChangePercent} changeMinor={incomeChangeMinor} inverse />
            </div>
          </div>
          <div className="flex items-center justify-between py-2.5">
            <span className="text-[14px] text-ink">지출</span>
            <div className="flex items-center gap-2">
              <span className="tabular-nums text-[14px] text-ink-muted">{formatMoney(expense, currency)}</span>
              <ChangeBadge percent={expenseChangePercent} changeMinor={expenseChangeMinor} />
            </div>
          </div>
          {topDeltas.map((d) => (
            <div key={d.categoryId} className="flex items-center justify-between py-2.5">
              <span className="text-[14px] text-ink">{d.name}</span>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-[14px] text-ink-muted">{formatMoney(d.currentAmountMinor, currency)}</span>
                <ChangeBadge percent={d.changePercent} changeMinor={d.changeMinor} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
