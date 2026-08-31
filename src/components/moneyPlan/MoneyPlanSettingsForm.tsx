"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import type { MonthlyMoneyPlan } from "@/types";
import { formatMoney, toMajorUnits, toMinorUnits } from "@/lib/money";
import { Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export function MoneyPlanSettingsForm({
  plan,
  hyundaiCardAutoKrwMinor,
  onSave,
}: {
  plan: MonthlyMoneyPlan;
  /** This month's auto-calculated 현대카드 spend, for the "자동 계산값" hint next to the override field. */
  hyundaiCardAutoKrwMinor: number;
  onSave: (
    patch: Partial<Pick<MonthlyMoneyPlan, "totalBudgetKrwMinor" | "hyundaiCardOverrideKrwMinor" | "includeRent">>
  ) => void;
}) {
  const [budgetText, setBudgetText] = useState(String(toMajorUnits(plan.totalBudgetKrwMinor, "KRW")));
  const [overrideEnabled, setOverrideEnabled] = useState(plan.hyundaiCardOverrideKrwMinor !== null);
  const [overrideText, setOverrideText] = useState(
    String(toMajorUnits(plan.hyundaiCardOverrideKrwMinor ?? hyundaiCardAutoKrwMinor, "KRW"))
  );
  const [includeRent, setIncludeRent] = useState(plan.includeRent);
  const [editingBudget, setEditingBudget] = useState(false);

  function saveBudget() {
    const parsed = Number(budgetText);
    if (!isNaN(parsed) && parsed >= 0) {
      onSave({ totalBudgetKrwMinor: toMinorUnits(parsed, "KRW") });
    }
    setEditingBudget(false);
  }

  function saveOverrideToggle(enabled: boolean) {
    setOverrideEnabled(enabled);
    onSave({ hyundaiCardOverrideKrwMinor: enabled ? toMinorUnits(Number(overrideText) || 0, "KRW") : null });
  }

  function saveOverrideValue() {
    if (!overrideEnabled) return;
    const parsed = Number(overrideText);
    if (!isNaN(parsed) && parsed >= 0) {
      onSave({ hyundaiCardOverrideKrwMinor: toMinorUnits(parsed, "KRW") });
    }
  }

  function saveIncludeRent(next: boolean) {
    setIncludeRent(next);
    onSave({ includeRent: next });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface px-4 py-4">
      <div>
        <Label>총 생활비 예산 (KRW)</Label>
        {editingBudget ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              inputMode="decimal"
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveBudget()}
            />
            <button onClick={saveBudget} className="text-accent">
              <Check size={20} />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditingBudget(true)} className="flex items-center gap-1.5">
            <span className="text-[20px] font-semibold tabular-nums text-ink">
              {formatMoney(plan.totalBudgetKrwMinor, "KRW")}
            </span>
            <Pencil size={13} className="text-ink-faint" />
          </button>
        )}
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <Label className="mb-0">현대카드 결제 예정액</Label>
          <div className="flex gap-1">
            <ToggleButton active={!overrideEnabled} onClick={() => saveOverrideToggle(false)}>
              자동 계산
            </ToggleButton>
            <ToggleButton active={overrideEnabled} onClick={() => saveOverrideToggle(true)}>
              직접 수정
            </ToggleButton>
          </div>
        </div>
        {overrideEnabled ? (
          <div className="mt-2 flex items-center gap-2">
            <Input
              inputMode="decimal"
              value={overrideText}
              onChange={(e) => setOverrideText(e.target.value)}
              onBlur={saveOverrideValue}
              onKeyDown={(e) => e.key === "Enter" && saveOverrideValue()}
            />
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-ink-muted">
            이번 달 현대카드 계좌 사용액 자동 계산: <span className="font-medium text-ink">{formatMoney(hyundaiCardAutoKrwMinor, "KRW")}</span>
          </p>
        )}
        <p className="mt-1 text-[12px] text-ink-faint">카드 결제액은 환전 대상에서 제외돼요.</p>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <Label className="mb-0">현지 고정비에 렌트 포함</Label>
          <div className="flex gap-1">
            <ToggleButton active={includeRent} onClick={() => saveIncludeRent(true)}>
              렌트 포함
            </ToggleButton>
            <ToggleButton active={!includeRent} onClick={() => saveIncludeRent(false)}>
              렌트 제외
            </ToggleButton>
          </div>
        </div>
        <p className="mt-1 text-[12px] text-ink-faint">렌트를 생활비 예산과 별도로 관리한다면 제외를 선택하세요.</p>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button variant={active ? "accent" : "outline"} size="sm" onClick={onClick} type="button" className={cn("text-[12px]")}>
      {children}
    </Button>
  );
}
