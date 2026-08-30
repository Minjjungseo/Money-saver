"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Plus, CalendarClock } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReserveCard } from "@/components/plan/ReserveCard";
import { RecurringExpenseFormSheet } from "@/components/plan/RecurringExpenseFormSheet";
import { PlannedExpenseFormSheet } from "@/components/plan/PlannedExpenseFormSheet";
import { PlannedIncomeFormSheet } from "@/components/plan/PlannedIncomeFormSheet";
import { FixedCostSummaryCard } from "@/components/plan/FixedCostSummaryCard";
import { formatMoney } from "@/lib/money";
import { PLANNED_EXPENSE_STATUS_LABELS, LIVING_BUDGET_IMPACT_LABELS, describeFrequency } from "@/lib/labels";
import { calculateFixedCostSummary } from "@/lib/calculations/fixedCosts";
import type { PlannedExpense, PlannedIncome, RecurringExpense } from "@/types";

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <button onClick={onAdd} className="flex items-center gap-1 text-[13px] font-medium text-accent">
        <Plus size={14} /> 추가
      </button>
    </div>
  );
}

export default function PlanPage() {
  const { data } = useData();
  const [recurringForm, setRecurringForm] = useState<{ open: boolean; editing: RecurringExpense | null }>({ open: false, editing: null });
  const [plannedForm, setPlannedForm] = useState<{ open: boolean; editing: PlannedExpense | null }>({ open: false, editing: null });
  const [incomeForm, setIncomeForm] = useState<{ open: boolean; editing: PlannedIncome | null }>({ open: false, editing: null });

  const recurring = [...data.recurringExpenses].sort((a, b) => {
    if (!a.nextDueDate && !b.nextDueDate) return 0;
    if (!a.nextDueDate) return 1; // undated items sort last
    if (!b.nextDueDate) return -1;
    return a.nextDueDate < b.nextDueDate ? -1 : 1;
  });
  const planned = [...data.plannedExpenses].sort((a, b) => (a.date < b.date ? -1 : 1));
  const incomes = [...data.plannedIncomes].sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1));
  const fixedCostSummary = calculateFixedCostSummary(
    data.recurringExpenses,
    data.budgets,
    data.settings.baseCurrency,
    data.exchangeRates
  );
  const hasFixedCostData =
    Object.keys(fixedCostSummary.includedByCurrency).length > 0 || Object.keys(fixedCostSummary.separateByCurrency).length > 0;

  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="px-5 text-[20px] font-semibold tracking-tight text-ink">예정된 돈</h1>

      <div className="px-5">
        <ReserveCard />
      </div>

      {hasFixedCostData && (
        <div className="px-5">
          <FixedCostSummaryCard summary={fixedCostSummary} />
        </div>
      )}

      <section className="flex flex-col gap-2">
        <SectionHeader title="정기 지출" onAdd={() => setRecurringForm({ open: true, editing: null })} />
        <div className="px-5">
          {recurring.length === 0 ? (
            <EmptyState
              icon={<CalendarClock size={24} />}
              title="아직 등록된 정기 지출이 없어요"
              description="월세, 구독료, 보험료처럼 반복되는 지출을 등록해보세요."
              action={<Button variant="accent" size="sm" onClick={() => setRecurringForm({ open: true, editing: null })}>정기 지출 추가</Button>}
            />
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {recurring.map((r) => {
                const account = data.accounts.find((a) => a.id === r.accountId);
                const paymentLabel = [account?.name, r.paymentNote].filter(Boolean).join(" · ");
                return (
                  <button
                    key={r.id}
                    onClick={() => setRecurringForm({ open: true, editing: r })}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[14px] font-medium text-ink">{r.name}</p>
                        {r.essential && <Badge tone="accent">필수</Badge>}
                        {r.status === "NEEDS_CONFIRMATION" && <Badge tone="warn">확인 필요</Badge>}
                        {r.livingBudgetImpact && (
                          <Badge tone={r.livingBudgetImpact === "SEPARATE" ? "warn" : "neutral"}>
                            {LIVING_BUDGET_IMPACT_LABELS[r.livingBudgetImpact]}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[12px] text-ink-muted">
                        {describeFrequency(r)} ·{" "}
                        {r.nextDueDate ? `다음 결제일 ${format(parseISO(r.nextDueDate), "M월 d일", { locale: ko })}` : "다음 결제일 설정 필요"}
                      </p>
                      {paymentLabel && <p className="text-[12px] text-ink-muted">{paymentLabel}</p>}
                      {r.actualCycleNote && <p className="text-[12px] text-ink-faint">{r.actualCycleNote}</p>}
                    </div>
                    <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink">
                      {r.amountMinor !== null ? formatMoney(r.amountMinor, r.currency) : "금액 확인 필요"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title="예정 지출" onAdd={() => setPlannedForm({ open: true, editing: null })} />
        <div className="px-5">
          {planned.length === 0 ? (
            <EmptyState
              title="아직 등록된 예정 지출이 없어요"
              description="여행이나 큰 지출처럼 한 번만 나갈 돈을 등록해보세요."
              action={<Button variant="accent" size="sm" onClick={() => setPlannedForm({ open: true, editing: null })}>예정 지출 추가</Button>}
            />
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {planned.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlannedForm({ open: true, editing: p })}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-medium text-ink">{p.name}</p>
                      <Badge tone={p.essential ? "accent" : "warn"}>{p.essential ? "필수" : "선택"}</Badge>
                      {p.status !== "PLANNED" && <Badge>{PLANNED_EXPENSE_STATUS_LABELS[p.status]}</Badge>}
                    </div>
                    <p className="text-[12px] text-ink-muted">{format(parseISO(p.date), "yyyy년 M월 d일", { locale: ko })}</p>
                  </div>
                  <span className="text-[14px] font-medium tabular-nums text-ink">
                    {formatMoney(p.expectedAmountMinor, p.currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title="예정 수입" onAdd={() => setIncomeForm({ open: true, editing: null })} />
        <div className="px-5">
          {incomes.length === 0 ? (
            <EmptyState
              title="아직 등록된 예정 수입이 없어요"
              description="들어올 예정인 급여나 수입을 등록해보세요."
              action={<Button variant="accent" size="sm" onClick={() => setIncomeForm({ open: true, editing: null })}>예정 수입 추가</Button>}
            />
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {incomes.map((inc) => (
                <button
                  key={inc.id}
                  onClick={() => setIncomeForm({ open: true, editing: inc })}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-medium text-ink">{inc.name}</p>
                      <Badge tone={inc.confirmed ? "accent" : "warn"}>{inc.confirmed ? "확정" : "예상"}</Badge>
                    </div>
                    <p className="text-[12px] text-ink-muted">{format(parseISO(inc.expectedDate), "yyyy년 M월 d일", { locale: ko })}</p>
                  </div>
                  <span className="text-[14px] font-medium tabular-nums text-accent">
                    +{formatMoney(inc.amountMinor, inc.currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <RecurringExpenseFormSheet
        open={recurringForm.open}
        onClose={() => setRecurringForm({ open: false, editing: null })}
        editing={recurringForm.editing}
      />
      <PlannedExpenseFormSheet
        open={plannedForm.open}
        onClose={() => setPlannedForm({ open: false, editing: null })}
        editing={plannedForm.editing}
      />
      <PlannedIncomeFormSheet
        open={incomeForm.open}
        onClose={() => setIncomeForm({ open: false, editing: null })}
        editing={incomeForm.editing}
      />
    </div>
  );
}
