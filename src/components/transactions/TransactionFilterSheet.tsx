"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Input";
import type { Account, Category, TransactionType } from "@/types";

export interface TransactionFilters {
  monthKey: string; // "ALL" or "yyyy-MM"
  accountId: string; // "ALL" or account id
  categoryId: string; // "ALL" or category id
  type: TransactionType | "ALL";
}

const TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
  EXCHANGE: "Exchange",
  REFUND: "Refund",
  CASH_WITHDRAWAL: "Cash Withdrawal",
};

export function TransactionFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  accounts,
  categories,
  monthOptions,
}: {
  open: boolean;
  onClose: () => void;
  filters: TransactionFilters;
  onChange: (next: TransactionFilters) => void;
  accounts: Account[];
  categories: Category[];
  monthOptions: { key: string; label: string }[];
}) {
  const topLevelCategories = categories.filter((c) => !c.parentId);

  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="flex flex-col gap-4">
        <div>
          <Label>Month</Label>
          <Select value={filters.monthKey} onChange={(e) => onChange({ ...filters, monthKey: e.target.value })}>
            <option value="ALL">All time</option>
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Account</Label>
          <Select value={filters.accountId} onChange={(e) => onChange({ ...filters, accountId: e.target.value })}>
            <option value="ALL">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Category</Label>
          <Select value={filters.categoryId} onChange={(e) => onChange({ ...filters, categoryId: e.target.value })}>
            <option value="ALL">All categories</option>
            {topLevelCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Transaction type</Label>
          <Select value={filters.type} onChange={(e) => onChange({ ...filters, type: e.target.value as TransactionType | "ALL" })}>
            <option value="ALL">All types</option>
            {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-2 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={() => onChange({ monthKey: "ALL", accountId: "ALL", categoryId: "ALL", type: "ALL" })}
          >
            Clear all
          </Button>
          <Button variant="accent" className="flex-1" onClick={onClose}>
            Apply
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
