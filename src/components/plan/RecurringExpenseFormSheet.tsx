"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import { FREQUENCY_LABELS, INTERVAL_UNIT_LABELS, LIVING_BUDGET_IMPACT_LABELS } from "@/lib/labels";
import type { CurrencyCode, IntervalUnit, LivingBudgetImpact, RecurringExpense, RecurringFrequency } from "@/types";

const CUSTOM_INTERVAL_COUNTS = [1, 2, 3, 6, 12];

export function RecurringExpenseFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: RecurringExpense | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "정기 지출 수정" : "정기 지출 추가"}>
      {open && <RecurringExpenseForm key={editing?.id ?? "new"} editing={editing} onDone={onClose} />}
    </Sheet>
  );
}

function RecurringExpenseForm({ editing, onDone }: { editing: RecurringExpense | null; onDone: () => void }) {
  const { data, addRecurringExpense, updateRecurringExpense, deleteRecurringExpense } = useData();

  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(
    editing?.amountMinor != null ? String(toMajorUnits(editing.amountMinor, editing.currency)) : ""
  );
  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? data.settings.baseCurrency);
  const [frequency, setFrequency] = useState<RecurringFrequency>(editing?.frequency ?? "MONTHLY");
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(editing?.customInterval?.unit ?? "MONTH");
  const [intervalCount, setIntervalCount] = useState(editing?.customInterval?.count ?? 2);
  const [nextDueDate, setNextDueDate] = useState(editing?.nextDueDate ?? (editing ? "" : format(new Date(), "yyyy-MM-dd")));
  const [monthlyEquivalent, setMonthlyEquivalent] = useState(
    editing?.monthlyEquivalentMinor != null ? String(toMajorUnits(editing.monthlyEquivalentMinor, editing.currency)) : ""
  );
  const [essential, setEssential] = useState(editing?.essential ?? true);
  const [accountId, setAccountId] = useState(editing?.accountId ?? data.accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [paymentNote, setPaymentNote] = useState(editing?.paymentNote ?? "");
  const [actualCycleNote, setActualCycleNote] = useState(editing?.actualCycleNote ?? "");
  const [livingBudgetImpact, setLivingBudgetImpact] = useState<LivingBudgetImpact | "">(
    editing?.livingBudgetImpact ?? ""
  );

  const canSave = name.trim() !== "" && (amount.trim() === "" || !isNaN(Number(amount)));

  function handleSave() {
    if (!canSave) return;
    const amountMinor = amount.trim() === "" ? null : toMinorUnits(Number(amount), currency);
    const nextDue = nextDueDate.trim() === "" ? null : nextDueDate;
    const payload = {
      name: name.trim(),
      amountMinor,
      currency,
      frequency,
      customInterval: frequency === "CUSTOM" ? { unit: intervalUnit, count: intervalCount } : null,
      monthlyEquivalentMinor: monthlyEquivalent.trim() === "" ? null : toMinorUnits(Number(monthlyEquivalent), currency),
      nextDueDate: nextDue,
      status: (amountMinor === null || nextDue === null ? "NEEDS_CONFIRMATION" : "ACTIVE") as RecurringExpense["status"],
      essential,
      accountId: accountId || null,
      paymentNote: paymentNote.trim() || null,
      actualCycleNote: actualCycleNote.trim() || null,
      livingBudgetImpact: livingBudgetImpact || null,
      startDate: editing?.startDate ?? nextDue ?? format(new Date(), "yyyy-MM-dd"),
      endDate: editing?.endDate ?? null,
      categoryId: categoryId || null,
    };
    if (editing) {
      updateRecurringExpense(editing.id, payload);
    } else {
      addRecurringExpense(payload);
    }
    onDone();
  }

  const topLevelCategories = data.categories.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>이름 *</Label>
        <Input placeholder="예: 월세" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <Label>금액 (실제 결제 기준)</Label>
          <Input inputMode="decimal" placeholder="아직 모르면 비워두세요" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="w-24">
          <option value="AUD">AUD</option>
          <option value="KRW">KRW</option>
        </Select>
      </div>
      <div>
        <Label>반복 주기</Label>
        <Select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}>
          {(Object.keys(FREQUENCY_LABELS) as RecurringFrequency[]).map((f) => (
            <option key={f} value={f}>
              {FREQUENCY_LABELS[f]}
            </option>
          ))}
        </Select>
        {frequency === "CUSTOM" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select value={intervalCount} onChange={(e) => setIntervalCount(Number(e.target.value))}>
              {CUSTOM_INTERVAL_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
            <Select value={intervalUnit} onChange={(e) => setIntervalUnit(e.target.value as IntervalUnit)}>
              {(Object.keys(INTERVAL_UNIT_LABELS) as IntervalUnit[]).map((u) => (
                <option key={u} value={u}>
                  {INTERVAL_UNIT_LABELS[u]}마다
                </option>
              ))}
            </Select>
          </div>
        )}
        {frequency === "TERM_BASED" && (
          <p className="mt-1 text-[12px] text-ink-faint">학기·텀 단위로 결제돼서 다음 결제일을 예측하기 어려운 항목이에요.</p>
        )}
      </div>
      <div>
        <Label>다음 결제일</Label>
        <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
        <p className="mt-1 text-[12px] text-ink-faint">아직 확정되지 않았으면 비워두세요. 임의로 날짜를 넣지 않아요.</p>
      </div>
      <div>
        <Label>월 환산 예산 참고값 (선택)</Label>
        <Input
          inputMode="decimal"
          placeholder="예: 실제 주기가 월 단위가 아닐 때 월평균 금액"
          value={monthlyEquivalent}
          onChange={(e) => setMonthlyEquivalent(e.target.value)}
        />
        <p className="mt-1 text-[12px] text-ink-faint">
          위 금액이 매달 결제되는 게 아니면, 예산 계산에 쓸 월평균 참고값을 여기에 적어주세요.
        </p>
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
      <div>
        <Label>결제 메모 (선택)</Label>
        <Input placeholder="예: 신한은행에서 결제" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} />
        <p className="mt-1 text-[12px] text-ink-faint">위 계좌 외에 실제 결제/정산이 이루어지는 곳이 따로 있다면 적어주세요.</p>
      </div>
      <div>
        <Label>실제 결제 주기 메모 (선택)</Label>
        <Input placeholder="예: 실제 2주마다 A$29.90" value={actualCycleNote} onChange={(e) => setActualCycleNote(e.target.value)} />
        <p className="mt-1 text-[12px] text-ink-faint">위 금액이 월평균 환산액일 때, 실제 결제 주기와 금액을 적어주세요.</p>
      </div>
      <div>
        <Label>생활비 구분</Label>
        <Select value={livingBudgetImpact} onChange={(e) => setLivingBudgetImpact(e.target.value as LivingBudgetImpact | "")}>
          <option value="">구분 없음</option>
          {(Object.keys(LIVING_BUDGET_IMPACT_LABELS) as LivingBudgetImpact[]).map((v) => (
            <option key={v} value={v}>
              {LIVING_BUDGET_IMPACT_LABELS[v]}
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
              deleteRecurringExpense(editing.id);
              onDone();
            }}
            type="button"
          >
            삭제
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "저장" : "정기 지출 추가"}
        </Button>
      </div>
    </div>
  );
}
