import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/Badge";
import type { Account } from "@/types";

export function AccountCard({ account, onClick }: { account: Account; onClick: () => void }) {
  const confirmed = Boolean(account.balanceAsOfDate);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-muted"
    >
      <div>
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-medium text-ink">{account.name}</p>
          {!account.includeInAvailable && <Badge tone="warn">제외됨</Badge>}
        </div>
        <p className="text-[13px] text-ink-muted">
          {account.bank || "—"} · {account.currency}
        </p>
      </div>
      <div className="text-right">
        {confirmed ? (
          <>
            <p className="text-[16px] font-semibold tabular-nums text-ink">
              {formatMoney(account.balanceMinor, account.currency)}
            </p>
            <p className="text-[11px] text-ink-faint">
              마지막 확인: {format(parseISO(account.balanceAsOfDate!), "yyyy.MM.dd", { locale: ko })}
            </p>
          </>
        ) : (
          <>
            <p className="text-[16px] font-semibold text-warn">잔액 미확인</p>
            <p className="text-[11px] text-ink-faint">눌러서 확인해주세요</p>
          </>
        )}
      </div>
    </button>
  );
}
