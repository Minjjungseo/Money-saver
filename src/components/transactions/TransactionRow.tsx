import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/Badge";
import type { Category, Transaction } from "@/types";

const TYPE_TONE: Record<Transaction["transactionType"], { label: string; showBadge: boolean }> = {
  EXPENSE: { label: "", showBadge: false },
  INCOME: { label: "", showBadge: false },
  REFUND: { label: "Refund", showBadge: true },
  TRANSFER: { label: "Transfer", showBadge: true },
  EXCHANGE: { label: "Exchange", showBadge: true },
  CASH_WITHDRAWAL: { label: "Cash Withdrawal", showBadge: true },
};

export function TransactionRow({
  tx,
  category,
  onClick,
}: {
  tx: Transaction;
  category: Category | undefined;
  onClick: () => void;
}) {
  const isInflow = tx.transactionType === "INCOME" || tx.transactionType === "REFUND" || tx.transactionType === "TRANSFER";
  const meta = TYPE_TONE[tx.transactionType];
  const categoryLabel = [category?.name, tx.subcategory].filter(Boolean).join(" · ");

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between py-3 text-left"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-medium text-ink">{tx.merchant}</p>
          {!tx.reviewed && <Badge tone="warn">Unreviewed</Badge>}
        </div>
        <p className="truncate text-[13px] text-ink-muted">
          {meta.showBadge ? meta.label : categoryLabel || "Uncategorized"}
        </p>
      </div>
      <span
        className={`shrink-0 pl-3 text-[15px] font-medium tabular-nums ${
          isInflow ? "text-accent" : "text-ink"
        }`}
      >
        {isInflow ? "+" : "-"}
        {formatMoney(tx.amountMinor, tx.currency)}
      </span>
    </button>
  );
}
