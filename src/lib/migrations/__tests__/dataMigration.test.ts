import { describe, expect, it } from "vitest";
import type { AppData, Transaction } from "@/types";
import { CANONICAL_TRANSACTIONS_2026 } from "@/data/canonicalTransactions2026";
import { buildDefaultCategories } from "@/lib/defaultCategories";
import { DEFAULT_SETTINGS } from "@/lib/repository";
import { runDataMigration } from "../dataMigration";

/**
 * Builds a synthetic "already imported, not yet classified" store that
 * mirrors the shape the user's real device is in: 611 transactions present
 * (like the earlier CSV/JSON restore produced), but with no categoryId,
 * scope, expenseBehavior, or source* fields set yet — i.e. exactly what the
 * migration is supposed to fix. This does NOT touch any real user data; it
 * only proves the migration's matching/backfill logic against a store
 * shaped like theirs. See the final report for what this does and doesn't
 * establish.
 */
function buildPreMigrationStore(): AppData {
  const transactions: Transaction[] = CANONICAL_TRANSACTIONS_2026.map((row, i) => {
    const currency = row.aud != null ? "AUD" : "KRW";
    const amountMinor =
      row.aud != null
        ? Math.round(row.aud * 100)
        : Math.round(row.krwExpense ?? row.krwIncome ?? row.original ?? 0);
    const transactionType = row.inout === "수입" ? "INCOME" : row.inout === "환불" ? "REFUND" : "EXPENSE";
    return {
      id: `txn_real_${i}`,
      date: row.date,
      merchant: row.merchant,
      amountMinor,
      currency,
      transactionType,
      categoryId: null,
      subcategory: null,
      accountId: null,
      memo: "",
      source: "JSON_IMPORT",
      importBatchId: null,
      aiConfidence: null,
      reviewed: false,
      originalFileRef: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  });

  return {
    accounts: [],
    transactions,
    categories: buildDefaultCategories(),
    recurringExpenses: [],
    plannedExpenses: [],
    plannedIncomes: [],
    budgets: [],
    importBatches: [],
    merchantRules: [],
    exchangeRates: [{ pair: "AUD_KRW", rate: 900, updatedAt: "2026-01-01T00:00:00.000Z" }],
    settings: { ...DEFAULT_SETTINGS },
  };
}

describe("runDataMigration", () => {
  it("matches all 611 canonical rows against a store shaped like the real one, with zero created/deleted", () => {
    const { data, summary } = runDataMigration(buildPreMigrationStore());

    expect(summary.canonicalTotal).toBe(611);
    expect(data.transactions.length).toBe(611);
    expect(summary.matched).toBe(611);
    expect(summary.unmatched).toBe(0);
    expect(summary.created).toBe(0);
    expect(summary.deleted).toBe(0);
  });

  it("categorizes 589 and leaves exactly 22 uncategorized (자산이동)", () => {
    const { summary } = runDataMigration(buildPreMigrationStore());
    expect(summary.categorizedCount).toBe(589);
    expect(summary.uncategorizedCount).toBe(22);
  });

  it("marks exactly 75 FIXED transactions, with the correct monthly breakdown incl. 12 in 2026-08", () => {
    const { summary } = runDataMigration(buildPreMigrationStore());
    expect(summary.fixedCount).toBe(75);
    expect(summary.fixedCountByMonth).toEqual({
      "2026-03": 6,
      "2026-04": 16,
      "2026-05": 12,
      "2026-06": 11,
      "2026-07": 18,
      "2026-08": 12,
    });
  });

  it("upserts exactly 8 RecurringExpense items with a non-zero INCLUDED sum", () => {
    const { data, summary } = runDataMigration(buildPreMigrationStore());
    expect(summary.recurringExpensesUpserted).toBe(8);
    expect(data.recurringExpenses.length).toBe(8);
    const includedSumMinor = data.recurringExpenses
      .filter((r) => r.livingBudgetImpact === "INCLUDED")
      .reduce((sum, r) => sum + (r.monthlyEquivalentMinor ?? r.amountMinor ?? 0), 0);
    expect(includedSumMinor).toBe(355700); // A$3,557.00
  });

  it("creates the default living budget only when none exists, and never overwrites an existing one", () => {
    const fresh = runDataMigration(buildPreMigrationStore());
    expect(fresh.summary.budgetCreated).toBe(true);
    expect(fresh.data.budgets.some((b) => b.name === "생활비")).toBe(true);

    const withUserBudget = buildPreMigrationStore();
    withUserBudget.budgets = [
      {
        id: "budget_user",
        name: "생활비",
        amountMinor: 99900,
        currency: "AUD",
        period: "WEEKLY",
        categoryId: null,
        active: true,
        subItems: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const preserved = runDataMigration(withUserBudget);
    expect(preserved.summary.budgetCreated).toBe(false);
    expect(preserved.data.budgets).toEqual(withUserBudget.budgets);
  });

  it("running twice is idempotent: second run reports 0 updated and stable totals", () => {
    const first = runDataMigration(buildPreMigrationStore());
    const second = runDataMigration(first.data);
    expect(second.summary.matched).toBe(611);
    expect(second.summary.updated).toBe(0);
    expect(second.summary.categorizedCount).toBe(589);
    expect(second.summary.fixedCount).toBe(75);
    expect(second.data.recurringExpenses.length).toBe(8);
  });

  it("never overwrites unrelated transaction fields (amount, date, merchant untouched)", () => {
    const before = buildPreMigrationStore();
    const { data } = runDataMigration(before);
    for (let i = 0; i < before.transactions.length; i++) {
      expect(data.transactions[i].amountMinor).toBe(before.transactions[i].amountMinor);
      expect(data.transactions[i].date).toBe(before.transactions[i].date);
      expect(data.transactions[i].merchant).toBe(before.transactions[i].merchant);
      expect(data.transactions[i].id).toBe(before.transactions[i].id);
    }
  });
});
