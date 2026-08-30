import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/Badge";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { needsScopeReview } from "@/lib/expenseClassification";
import type { Account, Category, Transaction } from "@/types";

const SHOW_TYPE_BADGE: Record<Transaction["transactionType"], boolean> = {
  EXPENSE: false,
  INCOME: false,
  REFUND: true,
  TRANSFER: true,
  EXCHANGE: true,
  CASH_WITHDRAWAL: true,
};

export function TransactionRow({
  tx,
  category,
  account,
  onClick,
}: {
  tx: Transaction;
  category: Category | undefined;
  account?: Account;
  onClick: () => void;
}) {
  const isInflow = tx.transactionType === "INCOME" || tx.transactionType === "REFUND" || tx.transactionType === "TRANSFER";
  const showTypeBadge = SHOW_TYPE_BADGE[tx.transactionType];
  const categoryText = showTypeBadge ? TRANSACTION_TYPE_LABELS[tx.transactionType] : [category?.name, tx.subcategory].filter(Boolean).join(" · ") || "카테고리 없음";
  const secondaryLabel = [categoryText, account?.name].filter(Boolean).join(" · ");
  const showScopeReview = !tx.scope && needsScopeReview(tx.merchant);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between py-3 text-left"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[15px] font-medium text-ink">{tx.merchant}</p>
          {!tx.reviewed && <Badge tone="warn">확인 필요</Badge>}
          {showScopeReview && <Badge tone="warn">분류 확인 필요</Badge>}
        </div>
        <p className="truncate text-[13px] text-ink-muted">{secondaryLabel}</p>
        <p className="text-[11px] text-ink-faint">{format(parseISO(tx.date), "M월 d일", { locale: ko })}</p>
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
