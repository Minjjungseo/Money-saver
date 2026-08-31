"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { MonthSelector } from "@/components/home/MonthSelector";
import { MoneyPlanSettingsForm } from "@/components/moneyPlan/MoneyPlanSettingsForm";
import { MoneyPlanBucketCard } from "@/components/moneyPlan/MoneyPlanBucketCard";
import { Select, Label } from "@/components/ui/Input";
import { formatMoney } from "@/lib/money";
import { calculateHyundaiCardAutoKrwMinor, calculateMoneyPlan } from "@/lib/calculations/moneyPlan";

export default function MoneyPlanPage() {
  const { data, upsertMoneyPlan, updateMoneyPlanBucketConfig } = useData();
  const [month, setMonth] = useState(new Date());
  const monthKey = format(month, "yyyy-MM");
  const monthLabel = format(month, "yyyy년 M월", { locale: ko });

  const existingPlan = data.moneyPlans.find((p) => p.month === monthKey);
  const plan =
    existingPlan ??
    ({
      id: "",
      month: monthKey,
      totalBudgetKrwMinor: 0,
      hyundaiCardOverrideKrwMinor: null,
      includeRent: true,
      createdAt: "",
      updatedAt: "",
    } as const);

  const hyundaiCardAutoKrwMinor = calculateHyundaiCardAutoKrwMinor(data.transactions, data.accounts, month, data.exchangeRates);

  const result =
    plan.totalBudgetKrwMinor > 0
      ? calculateMoneyPlan({
          month,
          monthKey,
          totalBudgetKrwMinor: plan.totalBudgetKrwMinor,
          hyundaiCardOverrideKrwMinor: plan.hyundaiCardOverrideKrwMinor,
          includeRent: plan.includeRent,
          transactions: data.transactions,
          accounts: data.accounts,
          recurringExpenses: data.recurringExpenses,
          bucketConfig: data.moneyPlanBucketConfig,
          rates: data.exchangeRates,
        })
      : null;

  const reserveAccount = data.accounts.find((a) => a.id === data.moneyPlanBucketConfig.reserveAccountId) ?? null;

  return (
    <div className="flex flex-col gap-5 pb-10 pt-6">
      <div className="flex items-center gap-2 px-5">
        <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted">
          <ChevronLeft size={19} />
        </Link>
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">{monthLabel} 돈 배치</h1>
      </div>

      <MonthSelector month={month} onChange={setMonth} />

      <div className="px-5">
        <MoneyPlanSettingsForm
          key={monthKey}
          plan={plan}
          hyundaiCardAutoKrwMinor={hyundaiCardAutoKrwMinor}
          onSave={(patch) => upsertMoneyPlan(monthKey, patch)}
        />
      </div>

      {result ? (
        <>
          <div className="flex flex-col gap-3 px-5">
            <MoneyPlanBucketCard
              bucket={result.koreaCard}
              purposeNote="한국 카드 결제용 — 이 계좌에 카드값만큼 남겨두면 돼요"
              accounts={data.accounts}
              onAccountChange={(id) => updateMoneyPlanBucketConfig({ koreaCardAccountId: id })}
            />
            <MoneyPlanBucketCard
              bucket={result.auFixed}
              purposeNote={`호주 현지 고정비 — 렌트 ${plan.includeRent ? "포함" : "제외"}`}
              accounts={data.accounts}
              onAccountChange={(id) => updateMoneyPlanBucketConfig({ auFixedAccountId: id })}
            />
            <MoneyPlanBucketCard
              bucket={result.living}
              purposeNote="생활비 — 변동 생활비 목표액"
              accounts={data.accounts}
              onAccountChange={(id) => updateMoneyPlanBucketConfig({ livingAccountId: id })}
            />
          </div>

          <div className="px-5">
            <div className="rounded-2xl border border-border bg-surface px-4 py-4">
              <p className="text-[14px] font-medium text-ink">선택적 예비비</p>
              <p className="text-[12px] text-ink-faint">필요할 때만 쓰는 여유 자금 — 목표액 계산에는 포함되지 않아요</p>
              <div className="mt-3">
                <Label className="mb-1">연결된 계좌</Label>
                <Select
                  value={data.moneyPlanBucketConfig.reserveAccountId ?? ""}
                  onChange={(e) => updateMoneyPlanBucketConfig({ reserveAccountId: e.target.value || null })}
                  className="h-9 text-[13px]"
                >
                  <option value="">계좌 선택 안 함</option>
                  {data.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </Select>
                {reserveAccount && (
                  <p className="mt-2 text-[13px] text-ink-muted">
                    현재 잔액 {formatMoney(reserveAccount.balanceMinor, reserveAccount.currency)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mx-5 rounded-2xl border border-accent-soft bg-accent-soft px-5 py-5 text-center">
            <p className="text-[13px] font-medium text-accent">이번 달 새로 환전할 돈</p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums text-accent">
              약 {formatMoney(result.newExchangeNeededKrwMinor, "KRW")}
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              약 {formatMoney(result.newExchangeNeededAudMinor, "AUD")} · CommBank 부족분 + 하나 부족분
            </p>
          </div>
        </>
      ) : (
        <p className="px-5 text-center text-[13px] text-ink-faint">
          위에서 이번 달 총 생활비 예산(KRW)을 입력하면 계좌별 배치가 계산돼요.
        </p>
      )}
    </div>
  );
}
