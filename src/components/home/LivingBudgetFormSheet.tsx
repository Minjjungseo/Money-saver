"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits, formatMoney } from "@/lib/money";
import { LIVING_BUDGET_NAME } from "@/lib/calculations/fixedCosts";
import type { Budget, BudgetPeriod, CurrencyCode } from "@/types";

const PERIOD_LABELS: Record<BudgetPeriod, string> = { WEEKLY: "주간", MONTHLY: "월간" };

const DEFAULT_ROWS = [
  { name: "장보기", amount: "170" },
  { name: "외식·카페", amount: "70" },
  { name: "쇼핑·아이", amount: "40" },
  { name: "교통·기타", amount: "20" },
];

export function LivingBudgetFormSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useData();
  const editing = data.budgets.find((b) => b.name === LIVING_BUDGET_NAME) ?? null;

  return (
    <Sheet open={open} onClose={onClose} title="생활비 예산 설정">
      {open && <LivingBudgetForm key={editing?.id ?? "new"} editing={editing} onDone={onClose} />}
    </Sheet>
  );
}

function LivingBudgetForm({ editing, onDone }: { editing: Budget | null; onDone: () => void }) {
  const { addBudget, updateBudget, deleteBudget } = useData();

  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? "AUD");
  const [basis, setBasis] = useState<BudgetPeriod>(editing?.period ?? "WEEKLY");
  const [rows, setRows] = useState<{ name: string; amount: string }[]>(() => {
    if (editing?.subItems && editing.subItems.length > 0) {
      return editing.subItems.map((si) => ({ name: si.name, amount: String(toMajorUnits(si.amountMinor, editing.currency)) }));
    }
    if (editing) {
      return [{ name: LIVING_BUDGET_NAME, amount: String(toMajorUnits(editing.amountMinor, editing.currency)) }];
    }
    return DEFAULT_ROWS;
  });

  const totalMajor = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const canSave = rows.every((r) => r.name.trim() !== "") && totalMajor > 0;

  function updateRow(i: number, patch: Partial<{ name: string; amount: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function handleSave() {
    if (!canSave) return;
    const subItems = rows.map((r) => ({ name: r.name.trim(), amountMinor: toMinorUnits(Number(r.amount) || 0, currency) }));
    const payload = {
      name: LIVING_BUDGET_NAME,
      amountMinor: toMinorUnits(totalMajor, currency),
      currency,
      period: basis,
      categoryId: null,
      active: true,
      subItems,
    };
    if (editing) {
      updateBudget(editing.id, payload);
    } else {
      addBudget(payload);
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[13px]">
        <p className="text-ink-muted">현재 활성 예산</p>
        <p className="mt-0.5 font-medium text-ink">
          {editing ? `${PERIOD_LABELS[editing.period]} ${formatMoney(editing.amountMinor, editing.currency)}` : "아직 없어요"}
        </p>
      </div>

      <div>
        <Label>기준</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PERIOD_LABELS) as BudgetPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setBasis(p)}
              className={`rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors ${
                basis === p ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-ink-muted hover:bg-surface-muted"
              }`}
            >
              {PERIOD_LABELS[p]} 예산으로 관리
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label>세부 항목</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="h-8 w-20 text-[12px]">
            <option value="AUD">AUD</option>
            <option value="KRW">KRW</option>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_auto] items-center gap-2">
              <Input value={row.name} onChange={(e) => updateRow(i, { name: e.target.value })} placeholder="항목명" />
              <Input inputMode="decimal" value={row.amount} onChange={(e) => updateRow(i, { amount: e.target.value })} placeholder="0.00" />
              <button
                type="button"
                onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                disabled={rows.length <= 1}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-faint hover:bg-surface-muted disabled:opacity-30"
                aria-label="항목 삭제"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { name: "", amount: "" }])}
          className="mt-2 flex items-center gap-1 text-[13px] font-medium text-accent"
        >
          <Plus size={14} /> 항목 추가
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3">
        <span className="text-[14px] text-ink">{PERIOD_LABELS[basis]} 예산 합계</span>
        <span className="text-[16px] font-semibold tabular-nums text-ink">{formatMoney(toMinorUnits(totalMajor, currency), currency)}</span>
      </div>

      <div className="mt-2 flex gap-2">
        {editing && (
          <Button
            variant="destructive"
            onClick={() => {
              deleteBudget(editing.id);
              onDone();
            }}
            type="button"
          >
            삭제
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "저장" : "예산 저장"}
        </Button>
      </div>
    </div>
  );
}
