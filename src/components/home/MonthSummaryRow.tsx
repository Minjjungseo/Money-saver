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
    { key: "income", label: "수입", value: income, tone: "accent" as const },
    { key: "expense", label: "지출", value: expense, tone: "negative" as const },
    { key: "net", label: "수입 - 지출", value: net, tone: net >= 0 ? ("accent" as const) : ("negative" as const) },
  ];
  return (
    <div className="grid grid-cols-3 gap-2 px-5">
      {items.map((item) => (
        <div key={item.key} className="rounded-2xl bg-surface border border-border px-3 py-3 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{item.label}</p>
          <p
            className={cn(
              "mt-1 break-all text-[14px] font-semibold tabular-nums",
              item.tone === "accent" ? "text-accent" : "text-negative"
            )}
          >
            {item.key === "net"
              ? `${item.value >= 0 ? "+" : ""}${formatMoney(item.value, currency)}`
              : formatMoney(item.value, currency)}
          </p>
        </div>
      ))}
    </div>
  );
}
