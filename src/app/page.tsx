"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, Wallet } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { useHomeMetrics } from "@/hooks/useHomeMetrics";
import { MonthSelector } from "@/components/home/MonthSelector";
import { AvailableToSpendCard } from "@/components/home/AvailableToSpendCard";
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
        <Header demoActive={false} />
        <div className="mt-8">
          <EmptyState
            icon={<Wallet size={28} />}
            title="아직 등록된 계좌가 없어요"
            description="계좌와 현재 잔고를 등록하면 지금 쓸 수 있는 돈을 볼 수 있어요."
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

  return (
    <div className="pt-6">
      <Header demoActive={data.settings.demoDataActive} />
      <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

      <AvailableToSpendCard
        breakdown={metrics.availableToSpend}
        currency={metrics.baseCurrency}
        readiness={metrics.readiness}
      />

      {metrics.latestTransactionDate && (
        <div className="mb-4">
          <DataFreshnessBanner latestDate={metrics.latestTransactionDate} daysBehind={metrics.daysBehind} />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <MonthSummaryRow income={metrics.income} expense={metrics.expense} net={metrics.net} currency={metrics.baseCurrency} />

        {metrics.weeklyBudget.budgetMinor > 0 && (
          <WeeklyBudgetCard usage={metrics.weeklyBudget} currency={metrics.baseCurrency} />
        )}

        <TrendChart
          trend={metrics.trend}
          currency={metrics.baseCurrency}
          selectedMonthKey={selectedMonthKey}
          onSelectMonth={(monthKey) => {
            const [y, m] = monthKey.split("-").map(Number);
            setSelectedMonth(new Date(y, m - 1, 1));
          }}
        />

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
