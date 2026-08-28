"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { BudgetFormSheet } from "@/components/settings/BudgetFormSheet";
import type { Budget } from "@/types";

const PERIOD_LABELS = { WEEKLY: "매주", MONTHLY: "매월" } as const;

export function BudgetManager() {
  const { data } = useData();
  const [form, setForm] = useState<{ open: boolean; editing: Budget | null }>({ open: false, editing: null });
  const categoryById = new Map(data.categories.map((c) => [c.id, c]));

  return (
    <div className="flex flex-col gap-2">
      {data.budgets.length === 0 ? (
        <p className="px-1 text-[13px] text-ink-muted">아직 등록된 예산이 없어요.</p>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {data.budgets.map((b) => (
            <button
              key={b.id}
              onClick={() => setForm({ open: true, editing: b })}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <p className={`text-[14px] font-medium ${b.active ? "text-ink" : "text-ink-faint"}`}>{b.name}</p>
                <p className="text-[12px] text-ink-muted">
                  {PERIOD_LABELS[b.period]}
                  {b.categoryId && categoryById.get(b.categoryId) ? ` · ${categoryById.get(b.categoryId)!.name}` : ""}
                  {!b.active && " · 비활성"}
                </p>
              </div>
              <span className="text-[14px] font-medium tabular-nums text-ink">
                {formatMoney(b.amountMinor, b.currency)}
              </span>
            </button>
          ))}
        </div>
      )}
      <Button variant="secondary" onClick={() => setForm({ open: true, editing: null })}>
        <Plus size={15} /> 예산 추가
      </Button>
      <BudgetFormSheet open={form.open} onClose={() => setForm({ open: false, editing: null })} editing={form.editing} />
    </div>
  );
}
