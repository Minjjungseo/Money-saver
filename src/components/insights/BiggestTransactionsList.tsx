import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { BiggestTransaction } from "@/lib/calculations/insights";
import type { CurrencyCode } from "@/types";

export function BiggestTransactionsList({ items, currency }: { items: BiggestTransaction[]; currency: CurrencyCode }) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>가장 큰 지출</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <p className="py-2 text-sm text-ink-muted">이번 달에는 아직 지출 내역이 없어요.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {items.map(({ transaction, amountInBase }) => (
              <div key={transaction.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[14px] font-medium text-ink">{transaction.merchant}</p>
                  <p className="text-[12px] text-ink-muted">{format(parseISO(transaction.date), "M월 d일", { locale: ko })}</p>
                </div>
                <span className="tabular-nums text-[14px] font-medium text-ink">
                  {formatMoney(amountInBase, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
