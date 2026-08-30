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
import { formatMoney } from "@/lib/money";
import { convertToBase } from "@/lib/exchange";
import { BUDGET_NATURE_LABELS } from "@/lib/labels";
import { resolveBudgetNature } from "@/lib/budgetNature";
import { cn } from "@/lib/cn";
import type { BudgetNature, Category, Transaction } from "@/types";

const NATURE_FILTERS: (BudgetNature | "ALL")[] = ["LIVING", "FIXED", "BUSINESS", "SEPARATE", "ALL"];

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultFilters(): TransactionFilters {
  return { monthKey: currentMonthKey(), accountId: "ALL", categoryId: "ALL", type: "ALL", nature: "LIVING" };
}

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
  const [filters, setFilters] = useState<TransactionFilters>(defaultFilters);

  const categoryById = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const accountById = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts]);

  const monthOptions = useMemo(() => {
    const keys = new Set(data.transactions.map(monthKeyOf));
    keys.add(currentMonthKey());
    return Array.from(keys)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((key) => ({ key, label: format(parseISO(`${key}-01`), "yyyy년 M월") }));
  }, [data.transactions]);

  const activeFilterCount = [filters.categoryId, filters.type].filter((v) => v !== "ALL").length;

  const byNatureAccountMonth = useMemo(() => {
    return data.transactions.filter((tx) => {
      if (filters.monthKey !== "ALL" && monthKeyOf(tx) !== filters.monthKey) return false;
      if (filters.accountId !== "ALL" && tx.accountId !== filters.accountId) return false;
      if (filters.nature !== "ALL" && resolveBudgetNature(tx, data.categories) !== filters.nature) return false;
      return true;
    });
  }, [data.transactions, data.categories, filters.monthKey, filters.accountId, filters.nature]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return byNatureAccountMonth.filter((tx) => {
      if (filters.categoryId !== "ALL" && topLevelCategoryOf(tx.categoryId, categoryById) !== filters.categoryId) return false;
      if (filters.type !== "ALL" && tx.transactionType !== filters.type) return false;
      if (q) {
        const category = tx.categoryId ? categoryById.get(tx.categoryId) : null;
        const haystack = `${tx.merchant} ${category?.name ?? ""} ${tx.subcategory ?? ""} ${tx.memo ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [byNatureAccountMonth, search, filters.categoryId, filters.type, categoryById]);

  const summary = useMemo(() => {
    const totalMinor = byNatureAccountMonth.reduce((sum, tx) => {
      if (tx.transactionType !== "EXPENSE" && tx.transactionType !== "CASH_WITHDRAWAL" && tx.transactionType !== "REFUND") return sum;
      const amount = convertToBase(tx.amountMinor, tx.currency, data.settings.baseCurrency, data.exchangeRates);
      return sum + (tx.transactionType === "REFUND" ? -amount : amount);
    }, 0);

    const byCategory = new Map<string, number>();
    for (const tx of byNatureAccountMonth) {
      if (tx.transactionType !== "EXPENSE" && tx.transactionType !== "CASH_WITHDRAWAL" && tx.transactionType !== "REFUND") continue;
      const topId = topLevelCategoryOf(tx.categoryId, categoryById) ?? "cat_other";
      const amount = convertToBase(tx.amountMinor, tx.currency, data.settings.baseCurrency, data.exchangeRates);
      byCategory.set(topId, (byCategory.get(topId) ?? 0) + (tx.transactionType === "REFUND" ? -amount : amount));
    }
    const topCategories = Array.from(byCategory.entries())
      .filter(([, amount]) => amount > 0)
      .map(([id, amountMinor]) => ({ id, name: categoryById.get(id)?.name ?? "기타", amountMinor }))
      .sort((a, b) => b.amountMinor - a.amountMinor)
      .slice(0, 5);

    return { totalMinor, topCategories };
  }, [byNatureAccountMonth, categoryById, data.settings.baseCurrency, data.exchangeRates]);

  const monthLabel = filters.monthKey === "ALL" ? "전체 기간" : format(parseISO(`${filters.monthKey}-01`), "yyyy년 M월");
  const natureLabel = filters.nature === "ALL" ? "전체" : BUDGET_NATURE_LABELS[filters.nature];

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

      <div className="mt-3 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none]">
        {NATURE_FILTERS.map((n) => (
          <Chip key={n} active={filters.nature === n} onClick={() => setFilters((f) => ({ ...f, nature: n }))}>
            {n === "ALL" ? "전체" : BUDGET_NATURE_LABELS[n]}
          </Chip>
        ))}
      </div>

      {data.accounts.length > 0 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto px-5 pb-0.5 [scrollbar-width:none]">
          <Chip active={filters.accountId === "ALL"} onClick={() => setFilters((f) => ({ ...f, accountId: "ALL" }))}>
            전체 계좌
          </Chip>
          {data.accounts.map((a) => (
            <Chip key={a.id} active={filters.accountId === a.id} onClick={() => setFilters((f) => ({ ...f, accountId: a.id }))}>
              {a.name}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-4 px-5">
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
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-surface px-4 py-3.5">
              <p className="text-[12px] text-ink-muted">
                {monthLabel} · {natureLabel}
              </p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-ink">
                총 사용 {formatMoney(summary.totalMinor, data.settings.baseCurrency)}
              </p>
              {summary.topCategories.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-muted">
                  {summary.topCategories.map((c) => (
                    <span key={c.id}>
                      {c.name} {formatMoney(c.amountMinor, data.settings.baseCurrency)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4">
              {filtered.length === 0 ? (
                <EmptyState title="해당하는 거래가 없어요" description="다른 필터를 선택하거나 검색어를 바꿔보세요." />
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
                            account={tx.accountId ? accountById.get(tx.accountId) : undefined}
                            onClick={() => openManual(tx.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
        active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-ink-muted hover:bg-surface-muted"
      )}
    >
      {children}
    </button>
  );
}
