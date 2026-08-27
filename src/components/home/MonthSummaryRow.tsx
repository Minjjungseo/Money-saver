import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";
import { cn } from "@/lib/cn";

export function MonthSummaryRow({
  income,
  expense,
  net,
  currency,
}: {
  income: number;
  expense: number;
  net: number;
  currency: CurrencyCode;
}) {
  const items = [
    { label: "Income", value: income, tone: "accent" as const },
    { label: "Expense", value: expense, tone: "negative" as const },
    { label: "Net", value: net, tone: net >= 0 ? ("accent" as const) : ("negative" as const) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 px-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl bg-surface border border-border px-3 py-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{item.label}</p>
          <p
            className={cn(
              "mt-1 text-[16px] font-semibold tabular-nums",
              item.tone === "accent" ? "text-accent" : "text-negative"
            )}
          >
            {item.label === "Net"
              ? `${item.value >= 0 ? "+" : ""}${formatMoney(item.value, currency)}`
              : formatMoney(item.value, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}
