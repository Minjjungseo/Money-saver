"use client";

import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ArrowRight } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { calculateMoneyPlan, type MoneyPlanBucketResult } from "@/lib/calculations/moneyPlan";
import { MONEY_PLAN_STATUS_LABEL, MONEY_PLAN_STATUS_TONE } from "@/components/moneyPlan/statusStyles";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

/**
 * "이번 달 돈 배치" — HOME 상단 핵심 카드. 이 카드가 답하는 질문은 계좌 총
 * 잔액이 아니라 "이 돈은 무엇을 위해 남겨둔 돈인가"다. 항상 오늘 기준 실제
 * 달(currently-real month)을 보여준다 — HOME의 히스토리 월 선택과는 무관.
 */
export function MoneyPlanCard() {
  const { data } = useData();
  const now = new Date();
  const monthKey = format(now, "yyyy-MM");
  const monthLabel = format(now, "M월", { locale: ko });
  const plan = data.moneyPlans.find((p) => p.month === monthKey);

  if (!plan || plan.totalBudgetKrwMinor <= 0) {
    return (
      <div className="mx-5 rounded-2xl border border-border bg-surface px-5 py-6 text-center">
        <p className="text-[13px] font-medium text-ink-muted">{monthLabel} 돈 배치</p>
        <p className="mt-1 text-[15px] font-medium text-warn">아직 이번 달 생활비 예산(KRW)이 없어요</p>
        <p className="mt-1 text-[12px] text-ink-faint">
          월 생활비 예산을 원화로 입력하면 어느 계좌에 얼마를 두고 얼마를 환전해야 할지 바로 알려드려요.
        </p>
        <Link href="/money-plan" className="mt-3 inline-block text-[13px] font-medium text-accent">
          이번 달 돈 배치 설정하기 →
        </Link>
      </div>
    );
  }

  const result = calculateMoneyPlan({
    month: now,
    monthKey,
    totalBudgetKrwMinor: plan.totalBudgetKrwMinor,
    hyundaiCardOverrideKrwMinor: plan.hyundaiCardOverrideKrwMinor,
    includeRent: plan.includeRent,
    transactions: data.transactions,
    accounts: data.accounts,
    recurringExpenses: data.recurringExpenses,
    bucketConfig: data.moneyPlanBucketConfig,
    rates: data.exchangeRates,
  });

  return (
    <div className="mx-5 rounded-2xl border border-border bg-surface px-5 py-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-muted">{monthLabel} 돈 배치</p>
        <Link href="/money-plan" className="flex items-center gap-0.5 text-[12px] font-medium text-accent">
          자세히 보기 <ArrowRight size={12} />
        </Link>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[13px] text-ink-muted">총 생활비 예산</span>
        <span className="text-[20px] font-semibold tabular-nums text-ink">{formatMoney(plan.totalBudgetKrwMinor, "KRW")}</span>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-border border-t border-border">
        <BucketRow label="현대카드 결제" bucket={result.koreaCard} />
        <BucketRow label="현지 고정비" bucket={result.auFixed} />
        <BucketRow label="생활비 목표" bucket={result.living} showBalanceDetail />
      </div>

      {result.budgetExceeded && (
        <p className="mt-3 rounded-lg bg-negative-soft px-3 py-2 text-[12px] font-medium text-negative">
          이번 달 예산으로는 카드 결제와 현지 고정비도 다 채우지 못해요.
        </p>
      )}

      <div className="mt-3 border-t border-border pt-3 text-center">
        <p className="text-[12px] text-ink-muted">새로 환전할 돈</p>
        <p className="mt-0.5 text-[24px] font-semibold tabular-nums text-accent">
          약 {formatMoney(result.newExchangeNeededKrwMinor, "KRW")}
        </p>
      </div>
    </div>
  );
}

function BucketRow({
  label,
  bucket,
  showBalanceDetail,
}: {
  label: string;
  bucket: MoneyPlanBucketResult;
  showBalanceDetail?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-[13px] text-ink-muted">{label}</p>
        <p className="mt-0.5 text-[14px] font-medium tabular-nums text-ink">{formatMoney(bucket.requiredMinor, bucket.currency)}</p>
        <p className="text-[12px] text-ink-faint">
          → {bucket.accountName ?? "계좌 연결 필요"}
          {showBalanceDetail && bucket.currentBalanceMinor !== null && (
            <>
              {" "}
              · 현재 {formatMoney(bucket.currentBalanceMinor, bucket.currency)}
              {bucket.shortfallMinor > 0 && ` + ${formatMoney(bucket.shortfallMinor, bucket.currency)} 필요`}
            </>
          )}
        </p>
      </div>
      <Badge tone={MONEY_PLAN_STATUS_TONE[bucket.status]} className={cn(bucket.status === "SUFFICIENT" && "opacity-80")}>
        {MONEY_PLAN_STATUS_LABEL[bucket.status]}
      </Badge>
    </div>
  );
}
