"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Settings as SettingsIcon, Wallet } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { hasDemoData } from "@/lib/demoData";
import { useHomeMetrics } from "@/hooks/useHomeMetrics";
import { MonthSelector } from "@/components/home/MonthSelector";
import { LivingBudgetCard } from "@/components/home/LivingBudgetCard";
import { FixedVsVariableCard } from "@/components/home/FixedVsVariableCard";
import { TopLivingSpendCard } from "@/components/home/TopLivingSpendCard";
import { AccountBalanceCard } from "@/components/home/AccountBalanceCard";
import { DataFreshnessBanner } from "@/components/home/DataFreshnessBanner";
import { MonthSummaryRow } from "@/components/home/MonthSummaryRow";
import { TrendChart } from "@/components/home/TrendChart";
import { CategoryBreakdownCard } from "@/components/home/CategoryBreakdownCard";
import { WeeklyBudgetCard } from "@/components/home/WeeklyBudgetCard";
import { UpcomingCard } from "@/components/home/UpcomingCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { Badge } from "@/components/ui/Badge";
import { convertMinor } from "@/lib/money";
import { getAudKrwRate } from "@/lib/exchange";
import type { ExchangeRate } from "@/types";

export default function HomePage() {
  const { data, loading } = useData();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const now = new Date();
  const metrics = useHomeMetrics(selectedMonth, now);
  const { openManual } = useAddFlow();

  if (loading) {
    return <div className="px-5 py-10 text-center text-sm text-ink-muted">불러오는 중…</div>;
  }

  if (data.accounts.length === 0) {
    return (
      <div className="px-5 pt-8">
        <Header demoActive={hasDemoData(data)} />
        <div className="mt-8">
          <EmptyState
            icon={<Wallet size={28} />}
            title="아직 등록된 계좌가 없어요"
            description="계좌와 현재 잔고를 등록하면 이번 달 생활비를 볼 수 있어요."
            action={
              <Link href="/accounts">
                <Button variant="accent">계좌 추가</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const selectedMonthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = format(selectedMonth, "yyyy년 M월", { locale: ko });

  const remainingSecondaryText =
    metrics.monthlyLivingBudgetMinor !== null && metrics.baseCurrency === "KRW"
      ? formatAud(metrics.monthlyLivingBudgetMinor - metrics.livingUsedMinor, data.exchangeRates)
      : undefined;

  return (
    <div className="pt-6">
      <Header demoActive={hasDemoData(data)} />
      <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

      {metrics.latestTransactionDate && (
        <div className="px-5">
          <DataFreshnessBanner latestDate={metrics.latestTransactionDate} daysBehind={metrics.daysBehind} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* 1. 이번 달 생활비 남은 금액 */}
        <LivingBudgetCard
          monthLabel={monthLabel}
          budgetMinor={metrics.monthlyLivingBudgetMinor}
          usedMinor={metrics.livingUsedMinor}
          currency={metrics.baseCurrency}
          remainingSecondaryText={remainingSecondaryText}
        />

        {/* 2. 고정지출 vs 변동생활비 */}
        {metrics.monthlyLivingBudgetMinor !== null && (
          <FixedVsVariableCard
            fixed={{ label: "고정지출", budgetMinor: metrics.fixedBudgetMinor, usedMinor: metrics.expenseTotals.householdFixedMinor }}
            variable={{ label: "변동생활비", budgetMinor: metrics.variableBudgetMinor, usedMinor: metrics.expenseTotals.householdVariableMinor }}
            currency={metrics.baseCurrency}
          />
        )}

        {/* 3+4. 카테고리별 생활비 TOP + 지난달 대비 증감 */}
        <TopLivingSpendCard items={metrics.livingSpendByBucket} currency={metrics.baseCurrency} />

        {/* 5. 계좌별 잔액 */}
        <AccountBalanceCard totalMinor={metrics.accountBalanceTotal} currency={metrics.baseCurrency} accounts={data.accounts} />

        {/* 6. 월별 수입·지출 그래프 */}
        <MonthSummaryRow income={metrics.income} expense={metrics.expense} net={metrics.net} currency={metrics.baseCurrency} />

        <TrendChart
          trend={metrics.trend}
          currency={metrics.baseCurrency}
          selectedMonthKey={selectedMonthKey}
          onSelectMonth={(monthKey) => {
            const [y, m] = monthKey.split("-").map(Number);
            setSelectedMonth(new Date(y, m - 1, 1));
          }}
        />

        {metrics.weeklyBudget.budgetMinor > 0 && (
          <WeeklyBudgetCard usage={metrics.weeklyBudget} currency={metrics.baseCurrency} />
        )}

        {metrics.categoryBreakdown.length === 0 ? (
          <div className="mx-5">
            <EmptyState
              title="아직 등록된 거래가 없어요."
              description="은행 거래내역 스크린샷을 올리거나 직접 입력해보세요."
              action={
                <Button variant="accent" onClick={() => openManual()}>
                  거래 추가
                </Button>
              }
            />
          </div>
        ) : (
          <CategoryBreakdownCard items={metrics.categoryBreakdown} currency={metrics.baseCurrency} />
        )}

        <UpcomingCard
          items={metrics.upcomingItems}
          currency={metrics.baseCurrency}
          thisWeekAvailable={metrics.thisWeekAvailable}
          monthRemainingSpending={metrics.monthRemainingSpending}
        />
      </div>
    </div>
  );
}

function formatAud(krwMinor: number, rates: ExchangeRate[]): string {
  const rate = getAudKrwRate(rates);
  const audMinor = convertMinor(krwMinor, "KRW", "AUD", rate);
  const major = Math.abs(audMinor) / 100;
  const sign = audMinor < 0 ? "-" : "";
  return `${sign}A$${major.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Header({ demoActive }: { demoActive: boolean }) {
  return (
    <div className="flex items-center justify-between px-5">
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-semibold tracking-tight text-ink">Money OS</span>
        {demoActive && <Badge tone="warn">예시 데이터</Badge>}
      </div>
      <Link
        href="/settings"
        aria-label="설정"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
      >
        <SettingsIcon size={19} />
      </Link>
    </div>
  );
}
