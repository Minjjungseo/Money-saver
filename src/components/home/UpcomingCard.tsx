import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";
import type { UpcomingItem } from "@/lib/calculations/upcoming";
import { Badge } from "@/components/ui/Badge";

export function UpcomingCard({
  items,
  currency,
  thisWeekAvailable,
  monthRemainingSpending,
}: {
  items: UpcomingItem[];
  currency: CurrencyCode;
  thisWeekAvailable: number;
  monthRemainingSpending: number;
}) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>Upcoming</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <p className="py-2 text-sm text-ink-muted">Nothing scheduled. Add a recurring or planned expense in Plan.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {items.map((item, i) => (
              <div key={`${item.kind}-${item.name}-${item.date}-${i}`} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[14px] font-medium text-ink">{item.name}</p>
                  <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <span>{format(parseISO(item.date), "MMM d")}</span>
                    {!item.essential && <Badge tone="warn">Optional</Badge>}
                  </div>
                </div>
                <span className="tabular-nums text-[14px] font-medium text-ink">
                  {formatMoney(item.amountMinor, item.currency)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">This week available</p>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-ink">
              {formatMoney(thisWeekAvailable, currency)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Month remaining spending</p>
            <p className="mt-0.5 text-[16px] font-semibold tabular-nums text-ink">
              {formatMoney(monthRemainingSpending, currency)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
