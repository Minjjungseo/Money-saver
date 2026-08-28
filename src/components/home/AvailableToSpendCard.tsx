"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { AvailableToSpendBreakdown } from "@/lib/calculations/availableToSpend";
import type { AvailableToSpendReadiness, ReadinessReason } from "@/lib/calculations/readiness";
import type { CurrencyCode } from "@/types";
import { cn } from "@/lib/cn";

const MISSING_LABELS: Record<ReadinessReason, string> = {
  ACCOUNT_BALANCE_UNCONFIRMED: "계좌 잔고 확인이 필요해요",
  NO_ESSENTIAL_EXPENSE: "필수 정기·예정 지출을 등록해주세요",
  NO_PLANNED_INCOME: "예정 수입을 등록해주세요",
  RESERVE_NOT_SET: "남겨둘 돈을 설정해주세요",
};

export function AvailableToSpendCard({
  breakdown,
  currency,
  readiness,
}: {
  breakdown: AvailableToSpendBreakdown;
  currency: CurrencyCode;
  readiness: AvailableToSpendReadiness;
}) {
  const [open, setOpen] = useState(false);
  const negative = breakdown.availableToSpend < 0;

  return (
    <div className="px-5 pt-2 pb-4">
      <p className="text-center text-[13px] font-medium uppercase tracking-wide text-ink-faint">
        지금 쓸 수 있는 돈
      </p>

      {readiness.ready ? (
        <p
          className={cn(
            "mt-1 text-center text-[44px] font-semibold leading-tight tracking-tight tabular-nums",
            negative ? "text-negative" : "text-ink"
          )}
        >
          {formatMoney(breakdown.availableToSpend, currency)}
        </p>
      ) : (
        <>
          <p className="mt-1 text-center text-[28px] font-semibold leading-tight tracking-tight tabular-nums text-ink-faint">
            {formatMoney(breakdown.availableToSpend, currency)}
          </p>
          <p className="mt-1 text-center text-[13px] font-medium text-warn">계산 준비 중</p>
          <p className="mt-0.5 text-center text-[12px] text-ink-faint">
            계좌 잔고와 예정 지출을 확인하면 정확해져요.
          </p>
        </>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="mx-auto mt-3 flex items-center gap-1 text-[13px] font-medium text-ink-muted"
      >
        계산 방법 보기
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mx-auto mt-3 flex max-w-xs flex-col gap-2 rounded-2xl bg-surface-muted p-4 text-sm">
          {!readiness.ready && (
            <div className="mb-1 flex flex-col gap-1 rounded-xl bg-warn-soft px-3 py-2.5 text-[12px] text-warn">
              {readiness.missing.map((reason) => (
                <span key={reason}>· {MISSING_LABELS[reason]}</span>
              ))}
            </div>
          )}
          <Row label="현재 잔고" value={formatMoney(breakdown.currentBalance, currency)} />
          <Row
            label="들어올 확정 수입"
            value={formatMoney(breakdown.confirmedIncoming, currency, { showSign: true })}
            positive
          />
          <Row
            label="앞으로 나갈 필수 지출"
            value={`- ${formatMoney(breakdown.upcomingEssential, currency)}`}
            negative
          />
          <Row label="남겨둘 돈" value={`- ${formatMoney(breakdown.reserve, currency)}`} negative />
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-semibold text-ink">
            <span>지금 쓸 수 있는 돈</span>
            <span>{formatMoney(breakdown.availableToSpend, currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums",
          positive && "text-accent",
          negative && "text-negative",
          !positive && !negative && "text-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}
