"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import { PLANNED_EXPENSE_STATUS_LABELS } from "@/lib/labels";
import type { CurrencyCode, PlannedExpense, PlannedExpenseStatus } from "@/types";

export function PlannedExpenseFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: PlannedExpense | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "예정 지출 수정" : "예정 지출 추가"}>
      {open && <PlannedExpenseForm key={editing?.id ?? "new"} editing={editing} onDone={onClose} />}
    </Sheet>
  );
}

function PlannedExpenseForm({ editing, onDone }: { editing: PlannedExpense | null; onDone: () => void }) {
  const { data, addPlannedExpense, updatePlannedExpense, deletePlannedExpense } = useData();

  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(toMajorUnits(editing.expectedAmountMinor, editing.currency)) : "");
  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? data.settings.baseCurrency);
  const [date, setDate] = useState(editing?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [essential, setEssential] = useState(editing?.essential ?? false);
  const [status, setStatus] = useState<PlannedExpenseStatus>(editing?.status ?? "PLANNED");
  const [accountId, setAccountId] = useState(editing?.accountId ?? data.accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");

  const canSave = name.trim() !== "" && amount.trim() !== "" && !isNaN(Number(amount)) && date !== "";

  function handleSave() {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      expectedAmountMinor: toMinorUnits(Number(amount), currency),
      currency,
      date,
      essential,
      status,
      accountId: accountId || null,
      categoryId: categoryId || null,
    };
    if (editing) {
      updatePlannedExpense(editing.id, payload);
    } else {
      addPlannedExpense(payload);
    }
    onDone();
  }

  const topLevelCategories = data.categories.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>이름 *</Label>
        <Input placeholder="예: 시드니 여행" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <Label>예상 금액 *</Label>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="w-24">
          <option value="AUD">AUD</option>
          <option value="KRW">KRW</option>
        </Select>
      </div>
      <div>
        <Label>날짜</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>카테고리</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">없음</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>상태</Label>
        <Select value={status} onChange={(e) => setStatus(e.target.value as PlannedExpenseStatus)}>
          {(Object.keys(PLANNED_EXPENSE_STATUS_LABELS) as PlannedExpenseStatus[]).map((s) => (
            <option key={s} value={s}>
              {PLANNED_EXPENSE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>계좌</Label>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">없음</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3">
        <div>
          <span className="text-[14px] text-ink">필수</span>
          <p className="text-[12px] text-ink-muted">지금 쓸 수 있는 돈 계산에 포함</p>
        </div>
        <input
          type="checkbox"
          checked={essential}
          onChange={(e) => setEssential(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
      </label>
      <div className="mt-2 flex gap-2">
        {editing && (
          <Button
            variant="destructive"
            onClick={() => {
              deletePlannedExpense(editing.id);
              onDone();
            }}
            type="button"
          >
            삭제
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "저장" : "예정 지출 추가"}
        </Button>
      </div>
    </div>
  );
}
