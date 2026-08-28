"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatMoney } from "@/lib/money";
import type { CategoryBreakdownItem } from "@/lib/calculations/categoryBreakdown";
import type { CurrencyCode } from "@/types";

const TOP_N = 5;

export function CategoryBreakdownCard({
  items,
  currency,
}: {
  items: CategoryBreakdownItem[];
  currency: CurrencyCode;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, TOP_N);

  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>이번 달 어디에 썼을까?</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">이번 달에는 아직 지출 내역이 없어요.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((item) => (
              <div key={item.categoryId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="font-medium text-ink">{item.name}</span>
                  <span className="tabular-nums text-ink-muted">{formatMoney(item.amountMinor, currency)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
            {items.length > TOP_N && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-1 text-[13px] font-medium text-accent"
              >
                {showAll ? "간단히 보기" : `전체 보기 (${items.length})`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
