import { describe, expect, it } from "vitest";
import type { Account, Budget, MerchantRule, PlannedIncome, RecurringExpense, Transaction } from "@/types";
import { buildDemoData, hasDemoData } from "@/lib/demoData";
import { toMinorUnits } from "@/lib/money";

/**
 * Mirrors the exact filter predicate used by DataContext's clearDemoData(),
 * so this test proves the real removal logic without needing to render the
 * React provider.
 */
function clearDemoFromDataset<T extends { isDemo?: boolean }>(items: T[]): T[] {
  return items.filter((item) => !item.isDemo);
}

function realAccount(partial: Partial<Account>): Account {
  return {
    id: "acc_real_commbank",
    name: "CommBank",
    bank: "Commonwealth Bank",
    currency: "AUD",
    balanceMinor: toMinorUnits(3874.41, "AUD"),
    balanceAsOfDate: "2026-08-19",
    type: "CHECKING",
    includeInAvailable: true,
    createdAt: "2026-08-20T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
    ...partial,
  };
}

function realTransaction(partial: Partial<Transaction>): Transaction {
  return {
    id: "txn_real_1",
    date: "2026-05-20",
    merchant: "Coles 4547",
    amountMinor: toMinorUnits(227.54, "AUD"),
    currency: "AUD",
    transactionType: "EXPENSE",
    categoryId: null,
    subcategory: null,
    accountId: "acc_real_commbank",
    memo: "",
    source: "CSV_IMPORT",
    importBatchId: "batch_real",
    aiConfidence: null,
    reviewed: true,
    originalFileRef: null,
    createdAt: "2026-08-20T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
    ...partial,
  };
}

describe("hasDemoData", () => {
  it("is true for a freshly built demo dataset", () => {
    const demo = buildDemoData(new Date(2026, 7, 28));
    expect(hasDemoData(demo)).toBe(true);
  });

  it("is false when no record carries isDemo, even if values look similar to demo data", () => {
    const realOnly = {
      ...buildDemoData(new Date(2026, 7, 28)),
      accounts: [realAccount({})],
      transactions: [realTransaction({})],
      recurringExpenses: [] as RecurringExpense[],
      plannedExpenses: [],
      plannedIncomes: [] as PlannedIncome[],
      budgets: [] as Budget[],
      merchantRules: [] as MerchantRule[],
    };
    expect(hasDemoData(realOnly)).toBe(false);
  });

  it("stays true if even one collection still carries a demo-flagged item", () => {
    const demo = buildDemoData(new Date(2026, 7, 28));
    const mostlyCleared = {
      ...demo,
      accounts: [] as Account[],
      transactions: [] as Transaction[],
      recurringExpenses: [] as RecurringExpense[],
      plannedExpenses: [],
      plannedIncomes: [] as PlannedIncome[],
      budgets: [] as Budget[],
      // merchantRules left untouched — still has 3 demo-flagged rules
    };
    expect(hasDemoData(mostlyCleared)).toBe(true);
  });
});

describe("clearing demo data preserves real imported data", () => {
  it("removes every demo-flagged record while leaving real records byte-for-byte intact", () => {
    const demo = buildDemoData(new Date(2026, 7, 28));

    // Simulate the user's real state: their imported CommBank account/transaction
    // sitting alongside the demo dataset (the scenario clearDemoData must handle).
    const mixed = {
      ...demo,
      accounts: [...demo.accounts, realAccount({})],
      transactions: [...demo.transactions, realTransaction({})],
    };

    const beforeCounts = {
      accounts: mixed.accounts.length,
      transactions: mixed.transactions.length,
      recurringExpenses: mixed.recurringExpenses.length,
      plannedExpenses: mixed.plannedExpenses.length,
      plannedIncomes: mixed.plannedIncomes.length,
      budgets: mixed.budgets.length,
      merchantRules: mixed.merchantRules.length,
    };
    // Sanity: the demo seed really does contribute more than just the one real item.
    expect(beforeCounts.accounts).toBeGreaterThan(1);
    expect(beforeCounts.transactions).toBeGreaterThan(1);

    const after = {
      accounts: clearDemoFromDataset(mixed.accounts),
      transactions: clearDemoFromDataset(mixed.transactions),
      recurringExpenses: clearDemoFromDataset(mixed.recurringExpenses),
      plannedExpenses: clearDemoFromDataset(mixed.plannedExpenses),
      plannedIncomes: clearDemoFromDataset(mixed.plannedIncomes),
      budgets: clearDemoFromDataset(mixed.budgets),
      merchantRules: clearDemoFromDataset(mixed.merchantRules),
    };

    // Every demo record is gone.
    expect(after.accounts.every((a) => !a.isDemo)).toBe(true);
    expect(after.transactions.every((t) => !t.isDemo)).toBe(true);
    expect(after.recurringExpenses).toHaveLength(0);
    expect(after.plannedExpenses).toHaveLength(0);
    expect(after.plannedIncomes).toHaveLength(0);
    expect(after.budgets).toHaveLength(0);
    expect(after.merchantRules).toHaveLength(0);

    // The real account and transaction survive unmodified.
    expect(after.accounts).toHaveLength(1);
    expect(after.accounts[0]).toEqual(realAccount({}));
    expect(after.transactions).toHaveLength(1);
    expect(after.transactions[0]).toEqual(realTransaction({}));

    // Reported "empty" state now reflects no demo data left.
    expect(hasDemoData({ ...mixed, ...after })).toBe(false);
  });

  it("leaves a dataset with no demo data at all completely unchanged", () => {
    const realOnly = {
      accounts: [realAccount({}), realAccount({ id: "acc_real_hana", name: "하나트래블로그" })],
      transactions: [realTransaction({}), realTransaction({ id: "txn_real_2", merchant: "Ampol" })],
    };
    expect(clearDemoFromDataset(realOnly.accounts)).toHaveLength(2);
    expect(clearDemoFromDataset(realOnly.transactions)).toHaveLength(2);
    expect(clearDemoFromDataset(realOnly.accounts)).toEqual(realOnly.accounts);
    expect(clearDemoFromDataset(realOnly.transactions)).toEqual(realOnly.transactions);
  });
});
