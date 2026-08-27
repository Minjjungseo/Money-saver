import { isWithinInterval } from "date-fns";
import type { Category, CurrencyCode, ExchangeRate, Transaction } from "@/types";
import { convertToBase } from "@/lib/exchange";
import { getMonthRange } from "./period";

export interface CategoryBreakdownItem {
  categoryId: string;
  name: string;
  amountMinor: number;
  percentage: number;
}

/** Net spend per top-level category this month (EXPENSE + CASH_WITHDRAWAL, minus REFUND). */
export function calculateCategoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  monthDate: Date,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): CategoryBreakdownItem[] {
  const { start, end } = getMonthRange(monthDate);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const topLevelOf = (categoryId: string | null): string => {
    if (!categoryId) return "cat_other";
    const c = categoryById.get(categoryId);
    if (!c) return "cat_other";
    return c.parentId ?? c.id;
  };

  const totals = new Map<string, number>();
  for (const tx of transactions) {
    const date = new Date(`${tx.date}T00:00:00`);
    if (!isWithinInterval(date, { start, end })) continue;
    if (tx.transactionType !== "EXPENSE" && tx.transactionType !== "CASH_WITHDRAWAL" && tx.transactionType !== "REFUND") {
      continue;
    }
    const topId = topLevelOf(tx.categoryId);
    const amount = convertToBase(tx.amountMinor, tx.currency, baseCurrency, rates);
    const signed = tx.transactionType === "REFUND" ? -amount : amount;
    totals.set(topId, (totals.get(topId) ?? 0) + signed);
  }

  const grandTotal = Array.from(totals.values())
    .filter((v) => v > 0)
    .reduce((a, b) => a + b, 0);

  return Array.from(totals.entries())
    .filter(([, amountMinor]) => amountMinor > 0)
    .map(([categoryId, amountMinor]) => ({
      categoryId,
      name: categoryById.get(categoryId)?.name ?? "Other",
      amountMinor,
      percentage: grandTotal > 0 ? (amountMinor / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}
