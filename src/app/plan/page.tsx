"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Plus, CalendarClock } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReserveCard } from "@/components/plan/ReserveCard";
import { RecurringExpenseFormSheet } from "@/components/plan/RecurringExpenseFormSheet";
import { PlannedExpenseFormSheet } from "@/components/plan/PlannedExpenseFormSheet";
import { PlannedIncomeFormSheet } from "@/components/plan/PlannedIncomeFormSheet";
import { formatMoney } from "@/lib/money";
import type { PlannedExpense, PlannedIncome, RecurringExpense } from "@/types";

const FREQUENCY_LABELS: Record<RecurringExpense["frequency"], string> = {
  WEEKLY: "Weekly",
  FORTNIGHTLY: "Fortnightly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SIX_MONTHLY: "6-Monthly",
  YEARLY: "Yearly",
};

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-5">
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      <button onClick={onAdd} className="flex items-center gap-1 text-[13px] font-medium text-accent">
        <Plus size={14} /> Add
      </button>
    </div>
  );
}

export default function PlanPage() {
  const { data } = useData();
  const [recurringForm, setRecurringForm] = useState<{ open: boolean; editing: RecurringExpense | null }>({ open: false, editing: null });
  const [plannedForm, setPlannedForm] = useState<{ open: boolean; editing: PlannedExpense | null }>({ open: false, editing: null });
  const [incomeForm, setIncomeForm] = useState<{ open: boolean; editing: PlannedIncome | null }>({ open: false, editing: null });

  const recurring = [...data.recurringExpenses].sort((a, b) => (a.nextDueDate < b.nextDueDate ? -1 : 1));
  const planned = [...data.plannedExpenses].sort((a, b) => (a.date < b.date ? -1 : 1));
  const incomes = [...data.plannedIncomes].sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1));

  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="px-5 text-[20px] font-semibold tracking-tight text-ink">Plan</h1>

      <ReserveCard />

      <section className="flex flex-col gap-2">
        <SectionHeader title="Recurring Expenses" onAdd={() => setRecurringForm({ open: true, editing: null })} />
        <div className="px-5">
          {recurring.length === 0 ? (
            <EmptyState
              icon={<CalendarClock size={24} />}
              title="No recurring expenses"
              description="Rent, subscriptions, insurance — anything that repeats."
              action={<Button variant="accent" size="sm" onClick={() => setRecurringForm({ open: true, editing: null })}>Add recurring expense</Button>}
            />
          ) : (
            <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {recurring.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRecurringForm({ open: true, editing: r })}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-medium text-ink">{r.name}</p>
                      {r.essential && <Badge tone="accent">Essential</Badge>}
                    </div>
                    <p className="text-[12px] text-ink-muted">
                      {FREQUENCY_LABELS[r.frequency]} · Next {format(parseISO(r.nextDueDate), "MMM d")}
                    </p>
                  </div>
                  <span className="text-[14px] font-medium tabular-nums text-ink">
                    {formatMoney(r.amountMinor, r.currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeader title="Planned Expenses" onAdd={() => setPlannedForm({ open: true, editing: null })} />
        <div className="px-5">
          {planned.length === 0 ? (
            <EmptyState
              title="No planned expenses"
              description="One-off future costs like a trip or a big purchase."
              action={<Button variant="accent" size="sm" onClick={() => setPlannedForm({ open: true, editing: null })}>Add planned expense</Button>}
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
                      <Badge tone={p.essential ? "accent" : "warn"}>{p.essential ? "Essential" : "Optional"}</Badge>
                      {p.status !== "PLANNED" && <Badge>{p.status === "PAID" ? "Paid" : "Cancelled"}</Badge>}
                    </div>
                    <p className="text-[12px] text-ink-muted">{format(parseISO(p.date), "MMM d, yyyy")}</p>
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
        <SectionHeader title="Planned Income" onAdd={() => setIncomeForm({ open: true, editing: null })} />
        <div className="px-5">
          {incomes.length === 0 ? (
            <EmptyState
              title="No planned income"
              description="Upcoming pay or expected money you're counting on."
              action={<Button variant="accent" size="sm" onClick={() => setIncomeForm({ open: true, editing: null })}>Add planned income</Button>}
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
                      <Badge tone={inc.confirmed ? "accent" : "warn"}>{inc.confirmed ? "Confirmed" : "Estimated"}</Badge>
                    </div>
                    <p className="text-[12px] text-ink-muted">{format(parseISO(inc.expectedDate), "MMM d, yyyy")}</p>
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
