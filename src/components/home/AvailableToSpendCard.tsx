"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatMoney } from "@/lib/money";
import type { AvailableToSpendBreakdown } from "@/lib/calculations/availableToSpend";
import type { CurrencyCode } from "@/types";
import { cn } from "@/lib/cn";

export function AvailableToSpendCard({
  breakdown,
  currency,
}: {
  breakdown: AvailableToSpendBreakdown;
  currency: CurrencyCode;
}) {
  const [open, setOpen] = useState(false);
  const negative = breakdown.availableToSpend < 0;

  return (
    <div className="px-5 pt-2 pb-4">
      <p className="text-center text-[13px] font-medium uppercase tracking-wide text-ink-faint">
        Available to Spend
      </p>
      <p
        className={cn(
          "mt-1 text-center text-[44px] font-semibold leading-tight tracking-tight tabular-nums",
          negative ? "text-negative" : "text-ink"
        )}
      >
        {formatMoney(breakdown.availableToSpend, currency)}
      </p>

      <button
        onClick={() => setOpen((v) => !v)}
        className="mx-auto mt-3 flex items-center gap-1 text-[13px] font-medium text-ink-muted"
      >
        How this is calculated
        <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="mx-auto mt-3 flex max-w-xs flex-col gap-2 rounded-2xl bg-surface-muted p-4 text-sm">
          <Row label="Current Balance" value={formatMoney(breakdown.currentBalance, currency)} />
          <Row
            label="Confirmed Incoming"
            value={formatMoney(breakdown.confirmedIncoming, currency, { showSign: true })}
            positive
          />
          <Row
            label="Upcoming Essential Expenses"
            value={`- ${formatMoney(breakdown.upcomingEssential, currency)}`}
            negative
          />
          <Row label="Reserve" value={`- ${formatMoney(breakdown.reserve, currency)}`} negative />
          <div className="mt-1 flex items-center justify-between border-t border-border pt-2 font-semibold text-ink">
            <span>Available to Spend</span>
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
