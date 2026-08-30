import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";
import { cn } from "@/lib/cn";

interface Slice {
  label: string;
  budgetMinor: number;
  usedMinor: number;
}

export function FixedVsVariableCard({ fixed, variable, currency }: { fixed: Slice; variable: Slice; currency: CurrencyCode }) {
  return (
    <div className="mx-5 grid grid-cols-2 gap-3">
      <SliceCard slice={fixed} currency={currency} />
      <SliceCard slice={variable} currency={currency} />
    </div>
  );
}

function SliceCard({ slice, currency }: { slice: Slice; currency: CurrencyCode }) {
  const remainingMinor = slice.budgetMinor - slice.usedMinor;
  const overBudget = remainingMinor < 0;
  const usageRate = slice.budgetMinor > 0 ? Math.min(100, (slice.usedMinor / slice.budgetMinor) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4">
      <p className="text-[13px] font-medium text-ink-muted">{slice.label}</p>
      <p className="mt-2 text-[12px] text-ink-faint">예산 {formatMoney(slice.budgetMinor, currency)}</p>
      <p className="mt-0.5 text-[14px] font-medium tabular-nums text-ink">사용 {formatMoney(slice.usedMinor, currency)}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className={cn("h-full rounded-full", overBudget ? "bg-negative" : "bg-accent")} style={{ width: `${usageRate}%` }} />
      </div>
      <p className={cn("mt-1.5 text-[12px] font-medium tabular-nums", overBudget ? "text-negative" : "text-ink-muted")}>
        남음 {formatMoney(remainingMinor, currency)}
      </p>
    </div>
  );
}
