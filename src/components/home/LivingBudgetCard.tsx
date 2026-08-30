import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";
import { cn } from "@/lib/cn";

export function LivingBudgetCard({
  monthLabel,
  budgetMinor,
  usedMinor,
  currency,
  remainingSecondaryText,
}: {
  monthLabel: string;
  budgetMinor: number | null;
  usedMinor: number;
  currency: CurrencyCode;
  /** Small AUD-equivalent (or other secondary currency) hint shown under the remaining amount. */
  remainingSecondaryText?: string;
}) {
  if (budgetMinor === null) {
    return (
      <div className="mx-5 rounded-2xl border border-border bg-surface px-5 py-6 text-center">
        <p className="text-[13px] font-medium text-ink-muted">{monthLabel} 생활비</p>
        <p className="mt-1 text-[15px] font-medium text-warn">아직 월 생활비 예산이 없어요</p>
        <p className="mt-1 text-[12px] text-ink-faint">
          설정에서 월(매월) 생활비 예산을 등록하면 이번 달 남은 생활비를 바로 볼 수 있어요.
        </p>
        <Link href="/plan" className="mt-3 inline-block text-[13px] font-medium text-accent">
          생활비 예산 설정하기 →
        </Link>
      </div>
    );
  }

  const remainingMinor = budgetMinor - usedMinor;
  const overBudget = remainingMinor < 0;
  const usageRate = budgetMinor > 0 ? Math.min(999, Math.round((usedMinor / budgetMinor) * 100)) : 0;

  return (
    <div className="mx-5 rounded-2xl border border-border bg-surface px-5 py-5">
      <p className="text-[13px] font-medium text-ink-muted">{monthLabel} 생활비</p>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[13px] text-ink-muted">남은 생활비</span>
        <span className={cn("text-[30px] font-semibold leading-tight tabular-nums", overBudget ? "text-negative" : "text-ink")}>
          {formatMoney(remainingMinor, currency)}
        </span>
      </div>
      {remainingSecondaryText && <p className="text-right text-[12px] text-ink-faint">약 {remainingSecondaryText}</p>}

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn("h-full rounded-full", overBudget ? "bg-negative" : "bg-accent")}
          style={{ width: `${Math.min(100, usageRate)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[12px] text-ink-faint">예산 사용률 {usageRate}%</p>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[13px]">
        <div>
          <p className="text-ink-muted">월 예산</p>
          <p className="mt-0.5 font-medium tabular-nums text-ink">{formatMoney(budgetMinor, currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-ink-muted">이번 달 사용</p>
          <p className="mt-0.5 font-medium tabular-nums text-ink">{formatMoney(usedMinor, currency)}</p>
        </div>
      </div>
    </div>
  );
}
