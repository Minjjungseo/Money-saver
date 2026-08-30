import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { Account, CurrencyCode } from "@/types";

export function AccountBalanceCard({
  totalMinor,
  currency,
  accounts,
}: {
  totalMinor: number;
  currency: CurrencyCode;
  accounts: Account[];
}) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>전체 계좌 잔액</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <p className="text-[26px] font-semibold tabular-nums text-ink">{formatMoney(totalMinor, currency)}</p>
        <p className="mt-1 text-[12px] text-ink-faint">렌트·학비·예비자금 포함</p>

        {accounts.length > 0 && (
          <div className="mt-4 flex flex-col gap-2.5 border-t border-border pt-3.5">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-[13px]">
                <span className="text-ink-muted">{a.name}</span>
                <span className="tabular-nums font-medium text-ink">{formatMoney(a.balanceMinor, a.currency)}</span>
              </div>
            ))}
          </div>
        )}

        <Link href="/accounts" className="mt-3 inline-block text-[13px] font-medium text-accent">
          계좌 자세히 보기 →
        </Link>
      </CardContent>
    </Card>
  );
}
