"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, Wallet } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { useHomeMetrics } from "@/hooks/useHomeMetrics";
import { MonthSelector } from "@/components/home/MonthSelector";
import { AvailableToSpendCard } from "@/components/home/AvailableToSpendCard";
import { MonthSummaryRow } from "@/components/home/MonthSummaryRow";
import { TrendChart } from "@/components/home/TrendChart";
import { CategoryBreakdownCard } from "@/components/home/CategoryBreakdownCard";
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
    return <div className="px-5 py-10 text-center text-sm text-ink-muted">Loading…</div>;
  }

  if (data.accounts.length === 0) {
    return (
      <div className="px-5 pt-8">
        <Header demoActive={false} />
        <div className="mt-8">
          <EmptyState
            icon={<Wallet size={28} />}
            title="No accounts yet"
            description="Add your first account with its current balance to see what you can spend."
            action={
              <Link href="/accounts">
                <Button variant="accent">Add an account</Button>
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

      <AvailableToSpendCard breakdown={metrics.availableToSpend} currency={metrics.baseCurrency} />

      <div className="flex flex-col gap-4">
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

        {metrics.categoryBreakdown.length === 0 ? (
          <div className="mx-5">
            <EmptyState
              title="No transactions yet."
              description="Upload your first bank screenshot or add one manually."
              action={
                <Button variant="accent" onClick={() => openManual()}>
                  Add a transaction
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
        {demoActive && <Badge tone="warn">Demo data</Badge>}
      </div>
      <Link
        href="/settings"
        aria-label="Settings"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
      >
        <SettingsIcon size={19} />
      </Link>
    </div>
  );
}
