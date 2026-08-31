"use client";

import type { Account } from "@/types";
import type { MoneyPlanBucketResult } from "@/lib/calculations/moneyPlan";
import { MONEY_PLAN_STATUS_LABEL, MONEY_PLAN_STATUS_TONE } from "./statusStyles";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/Badge";
import { Select, Label } from "@/components/ui/Input";

export function MoneyPlanBucketCard({
  bucket,
  purposeNote,
  accounts,
  onAccountChange,
}: {
  bucket: MoneyPlanBucketResult;
  /** One-line description of what this bucket's money is set aside for. */
  purposeNote: string;
  accounts: Account[];
  onAccountChange: (accountId: string | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface px-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] font-medium text-ink">{bucket.label}</p>
          <p className="text-[12px] text-ink-faint">{purposeNote}</p>
        </div>
        <Badge tone={MONEY_PLAN_STATUS_TONE[bucket.status]}>{MONEY_PLAN_STATUS_LABEL[bucket.status]}</Badge>
      </div>

      <div className="mt-3 flex items-center justify-between text-[13px]">
        <span className="text-ink-muted">필요</span>
        <span className="font-medium tabular-nums text-ink">{formatMoney(bucket.requiredMinor, bucket.currency)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[13px]">
        <span className="text-ink-muted">현재 보유</span>
        <span className="font-medium tabular-nums text-ink">
          {bucket.currentBalanceMinor === null ? "—" : formatMoney(bucket.currentBalanceMinor, bucket.currency)}
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[13px]">
        <span className="text-ink-muted">{bucket.shortfallMinor > 0 ? "부족액" : "여유"}</span>
        <span className={`font-medium tabular-nums ${bucket.shortfallMinor > 0 ? "text-negative" : "text-accent"}`}>
          {bucket.shortfallMinor > 0
            ? formatMoney(bucket.shortfallMinor, bucket.currency)
            : bucket.currentBalanceMinor === null
              ? "—"
              : formatMoney(bucket.currentBalanceMinor - bucket.requiredMinor, bucket.currency)}
        </span>
      </div>

      <div className="mt-3">
        <Label className="mb-1">연결된 계좌</Label>
        <Select
          value={bucket.accountId ?? ""}
          onChange={(e) => onAccountChange(e.target.value || null)}
          className="h-9 text-[13px]"
        >
          <option value="">계좌 선택 안 함</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
