import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { BiggestTransaction } from "@/lib/calculations/insights";
import type { CurrencyCode } from "@/types";

export function BiggestTransactionsList({ items, currency }: { items: BiggestTransaction[]; currency: CurrencyCode }) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>Biggest transactions</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <p className="py-2 text-sm text-ink-muted">Nothing recorded this month.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {items.map(({ transaction, amountInBase }) => (
              <div key={transaction.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[14px] font-medium text-ink">{transaction.merchant}</p>
                  <p className="text-[12px] text-ink-muted">{format(parseISO(transaction.date), "MMM d")}</p>
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
