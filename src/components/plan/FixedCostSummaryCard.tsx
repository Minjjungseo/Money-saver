import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { FixedCostSummary } from "@/lib/calculations/fixedCosts";
import { cn } from "@/lib/cn";

/** Only rendered when there's at least one "생활비 포함"/"생활비 별도" item to summarize. */
export function FixedCostSummaryCard({ summary }: { summary: FixedCostSummary }) {
  const currencies = Object.keys(summary.includedByCurrency) as (keyof typeof summary.includedByCurrency)[];
  const overBudget = summary.variableRemainingMinor !== null && summary.variableRemainingMinor < 0;
  const audReady = summary.includedByCurrency.AUD;

  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>월 고정비 요약</CardTitle>
      </CardHeader>
      <CardContent className="pt-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          {currencies.map((currency) => (
            <div key={currency} className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink-muted">{currency} 계좌 고정비</span>
              <span className="tabular-nums font-medium text-ink">
                {formatMoney(summary.includedByCurrency[currency] ?? 0, currency)}
              </span>
            </div>
          ))}
        </div>

        {summary.monthlyBudgetMinor !== null && (
          <div className="rounded-xl bg-surface-muted px-3.5 py-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-ink-muted">월 생활비 {formatMoney(summary.monthlyBudgetMinor, summary.baseCurrency)} 중 고정지출</span>
              <span className="tabular-nums text-[14px] font-medium text-ink">
                {formatMoney(summary.includedTotalBaseMinor, summary.baseCurrency)}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-[13px] text-ink-muted">변동생활비로 사용 가능</span>
              <span className={cn("tabular-nums text-[15px] font-semibold", overBudget ? "text-negative" : "text-accent")}>
                {formatMoney(summary.variableRemainingMinor ?? 0, summary.baseCurrency)}
              </span>
            </div>
          </div>
        )}

        {Object.keys(summary.separateByCurrency).length > 0 && (
          <div className="flex flex-col gap-1">
            {(Object.keys(summary.separateByCurrency) as (keyof typeof summary.separateByCurrency)[]).map((currency) => (
              <div key={currency} className="flex items-baseline justify-between text-[13px]">
                <span className="text-ink-muted">생활비 별도 (예: 렌트)</span>
                <span className="tabular-nums font-medium text-ink">
                  {formatMoney(summary.separateByCurrency[currency] ?? 0, currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        {audReady !== undefined && (
          <p className="text-[12px] text-ink-faint">다음 달 현지 고정비 준비액: {formatMoney(audReady, "AUD")}</p>
        )}
      </CardContent>
    </Card>
  );
}
