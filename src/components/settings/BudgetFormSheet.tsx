"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import type { Budget, BudgetPeriod, CurrencyCode } from "@/types";

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  WEEKLY: "매주",
  MONTHLY: "매월",
};

export function BudgetFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Budget | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "예산 수정" : "예산 추가"}>
      {open && <BudgetForm key={editing?.id ?? "new"} editing={editing} onDone={onClose} />}
    </Sheet>
  );
}

function BudgetForm({ editing, onDone }: { editing: Budget | null; onDone: () => void }) {
  const { data, addBudget, updateBudget, deleteBudget } = useData();

  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(toMajorUnits(editing.amountMinor, editing.currency)) : "");
  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? data.settings.baseCurrency);
  const [period, setPeriod] = useState<BudgetPeriod>(editing?.period ?? "WEEKLY");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [active, setActive] = useState(editing?.active ?? true);

  const canSave = name.trim() !== "" && amount.trim() !== "" && !isNaN(Number(amount));

  function handleSave() {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      amountMinor: toMinorUnits(Number(amount), currency),
      currency,
      period,
      categoryId: categoryId || null,
      active,
    };
    if (editing) {
      updateBudget(editing.id, payload);
    } else {
      addBudget(payload);
    }
    onDone();
  }

  const topLevelCategories = data.categories.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>이름 *</Label>
        <Input placeholder="예: 장보기" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <Label>금액 *</Label>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="w-24">
          <option value="AUD">AUD</option>
          <option value="KRW">KRW</option>
        </Select>
      </div>
      <div>
        <Label>주기</Label>
        <Select value={period} onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}>
          {(Object.keys(PERIOD_LABELS) as BudgetPeriod[]).map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>카테고리</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">전체 (카테고리 구분 없음)</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3">
        <span className="text-[14px] text-ink">사용 중</span>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
      </label>
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
          {editing ? "저장" : "예산 추가"}
        </Button>
      </div>
    </div>
  );
}
