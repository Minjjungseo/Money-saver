"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, Receipt } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useData } from "@/lib/context/DataContext";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { TransactionFilterSheet, type TransactionFilters } from "@/components/transactions/TransactionFilterSheet";
import type { Category, Transaction } from "@/types";

const DEFAULT_FILTERS: TransactionFilters = { monthKey: "ALL", accountId: "ALL", categoryId: "ALL", type: "ALL" };

function monthKeyOf(tx: Transaction) {
  return tx.date.slice(0, 7);
}

function topLevelCategoryOf(categoryId: string | null, categoryById: Map<string, Category>) {
  if (!categoryId) return null;
  const c = categoryById.get(categoryId);
  return c ? c.parentId ?? c.id : null;
}

export default function TransactionsPage() {
  const { data } = useData();
  const { openManual } = useAddFlow();
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS);

  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);

  const monthOptions = useMemo(() => {
    const keys = new Set(data.transactions.map(monthKeyOf));
    return Array.from(keys)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((key) => ({ key, label: format(parseISO(`${key}-01`), "yyyy년 M월") }));
  }, [data.transactions]);

  const activeFilterCount = Object.values(filters).filter((v) => v !== "ALL").length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.transactions.filter((tx) => {
      if (filters.monthKey !== "ALL" && monthKeyOf(tx) !== filters.monthKey) return false;
      if (filters.accountId !== "ALL" && tx.accountId !== filters.accountId) return false;
      if (filters.categoryId !== "ALL" && topLevelCategoryOf(tx.categoryId, categoryById) !== filters.categoryId) return false;
      if (filters.type !== "ALL" && tx.transactionType !== filters.type) return false;
      if (q) {
        const category = tx.categoryId ? categoryById.get(tx.categoryId) : null;
        const haystack = `${tx.merchant} ${category?.name ?? ""} ${tx.subcategory ?? ""} ${tx.memo ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [data.transactions, search, filters, categoryById]);

  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1)));
    const groups: { date: string; items: Transaction[] }[] = [];
    for (const tx of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.date === tx.date) {
        last.items.push(tx);
      } else {
        groups.push({ date: tx.date, items: [tx] });
      }
    }
    return groups;
  }, [filtered]);

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between px-5">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">내역</h1>
      </div>

      <div className="mt-4 flex items-center gap-2 px-5">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input
            placeholder="사용처, 카테고리, 메모 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant={activeFilterCount > 0 ? "accent" : "outline"} size="icon" onClick={() => setFiltersOpen(true)} aria-label="필터">
          <SlidersHorizontal size={17} />
        </Button>
      </div>

      <div className="mt-5 px-5">
        {data.transactions.length === 0 ? (
          <EmptyState
            icon={<Receipt size={28} />}
            title="아직 등록된 거래가 없어요."
            description="은행 거래내역 스크린샷을 올리거나 직접 입력해보세요."
            action={
              <Button variant="accent" onClick={() => openManual()}>
                거래 추가
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="검색 결과가 없어요" description="다른 검색어를 입력하거나 필터를 초기화해보세요." />
        ) : (
          <div className="flex flex-col">
            {grouped.map((group) => (
              <div key={group.date}>
                <p className="sticky top-0 bg-background py-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                  {format(parseISO(group.date), "M월 d일 (EEE)", { locale: ko })}
                </p>
                <div className="divide-y divide-border">
                  {group.items.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      category={tx.categoryId ? categoryById.get(tx.categoryId) : undefined}
                      onClick={() => openManual(tx.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        accounts={data.accounts}
        categories={data.categories}
        monthOptions={monthOptions}
      />
    </div>
  );
}
