import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { LivingSpendBucketItem } from "@/lib/calculations/livingBudget";
import type { CurrencyCode } from "@/types";
import { cn } from "@/lib/cn";

export function TopLivingSpendCard({ items, currency }: { items: LivingSpendBucketItem[]; currency: CurrencyCode }) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>이번 달 생활비 어디에 많이 썼어요?</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">이번 달 생활비 지출이 아직 없어요.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            {items.map((item, i) => (
              <div key={item.bucket} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2 text-[14px]">
                  <span className="font-medium text-ink">
                    {i + 1}. {item.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatMoney(item.amountMinor, currency)} · {Math.round(item.percentage)}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, item.percentage)}%` }} />
                </div>
                {item.prevAmountMinor > 0 && (
                  <p className={cn("text-[11px]", item.deltaMinor > 0 ? "text-negative" : item.deltaMinor < 0 ? "text-accent" : "text-ink-faint")}>
                    지난달보다 {item.deltaMinor > 0 ? "+" : item.deltaMinor < 0 ? "-" : "±"}
                    {formatMoney(Math.abs(item.deltaMinor), currency)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
