import type { AppData, DataMigrationSummary, Transaction } from "@/types";
import { CANONICAL_TRANSACTIONS_2026, type CanonicalTransactionRow } from "@/data/canonicalTransactions2026";
import { deriveCategoryId, deriveExpenseBehavior, deriveExpenseScope } from "./canonicalClassification";
import { upsertRecurringExpenseCatalog } from "./recurringExpenseCatalog";
import { ensureDefaultLivingBudget } from "./livingBudgetDefault";
import { nowIso } from "@/lib/id";

/**
 * Bump this whenever the migration logic or canonical dataset changes in a
 * way that should re-run against stores that already applied an earlier
 * version. Never bumped automatically on failure — see runOneTimeDataMigration
 * in DataContext, which only advances Settings.dataMigrationVersion after
 * this function returns successfully, so a failed run retries next load.
 */
export const DATA_MIGRATION_TARGET_VERSION = 1;

function normalizeMerchant(merchant: string): string {
  return merchant
    .replace(/\(.*?\)/g, "")
    .replace(/[^0-9A-Za-z가-힣]+/g, "")
    .toUpperCase()
    .trim();
}

function merchantMatches(txnMerchant: string, rowMerchant: string): boolean {
  const a = normalizeMerchant(txnMerchant);
  const b = normalizeMerchant(rowMerchant);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** AUD/KRW minor-unit candidates for a canonical row, or null when the row has neither (NZD/USD originals). */
function amountCandidatesMinor(row: CanonicalTransactionRow): { aud: number | null; krw: number | null } {
  const aud = row.aud != null ? Math.round(row.aud * 100) : null;
  const krwRaw = row.krwExpense ?? row.krwIncome;
  const krw = krwRaw != null ? Math.round(krwRaw) : null;
  return { aud, krw };
}

/**
 * True when an existing transaction's stored amount is consistent with a
 * canonical row. Rows with no AUD/KRW figure at all (the 9 NZD/USD-original
 * rows, whose converted value the original import chose independently) fall
 * back to date+merchant only, since there is no reliable value to compare.
 */
function amountMatches(transaction: Transaction, row: CanonicalTransactionRow): boolean {
  const { aud, krw } = amountCandidatesMinor(row);
  if (aud === null && krw === null) return true;
  if (transaction.currency === "AUD" && aud !== null) return Math.abs(transaction.amountMinor - aud) <= 2;
  if (transaction.currency === "KRW" && krw !== null) return Math.abs(transaction.amountMinor - krw) <= 1;
  return false;
}

interface MatchedRow {
  row: CanonicalTransactionRow;
  transactionId: string;
}

/**
 * Matches each of the 611 canonical rows to at most one existing transaction
 * (date + amount + fuzzy merchant name), each existing transaction consumed
 * at most once so same-day/same-amount duplicates (7 such pairs in the
 * canonical set) each land on a distinct real transaction instead of both
 * hitting the first one. Never creates or deletes — unmatched rows are
 * simply reported, per the migration spec's "matched/unmatched" requirement.
 */
function matchCanonicalRows(transactions: Transaction[]): { matches: MatchedRow[]; unmatchedRows: CanonicalTransactionRow[] } {
  const byDate = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = byDate.get(t.date);
    if (list) list.push(t);
    else byDate.set(t.date, [t]);
  }
  const consumed = new Set<string>();

  const matches: MatchedRow[] = [];
  const unmatchedRows: CanonicalTransactionRow[] = [];

  for (const row of CANONICAL_TRANSACTIONS_2026) {
    const candidates = (byDate.get(row.date) ?? []).filter(
      (t) => !consumed.has(t.id) && amountMatches(t, row) && merchantMatches(t.merchant, row.merchant)
    );
    if (candidates.length === 0) {
      unmatchedRows.push(row);
      continue;
    }
    const chosen = candidates[0];
    consumed.add(chosen.id);
    matches.push({ row, transactionId: chosen.id });
  }

  return { matches, unmatchedRows };
}

/** The backfill patch a canonical row writes onto its matched transaction — only these 6 fields, nothing else. */
function backfillPatch(row: CanonicalTransactionRow) {
  return {
    categoryId: deriveCategoryId(row),
    sourceClassification: row.classification,
    sourceNature: row.nature,
    sourceFixedVariable: row.fixedVariable,
    expenseBehavior: deriveExpenseBehavior(row),
    scope: deriveExpenseScope(row),
  };
}

function patchDiffers(transaction: Transaction, patch: ReturnType<typeof backfillPatch>): boolean {
  return (
    transaction.categoryId !== patch.categoryId ||
    transaction.sourceClassification !== patch.sourceClassification ||
    transaction.sourceNature !== patch.sourceNature ||
    transaction.sourceFixedVariable !== patch.sourceFixedVariable ||
    transaction.expenseBehavior !== patch.expenseBehavior ||
    transaction.scope !== patch.scope
  );
}

/**
 * Runs the one-time production data migration: backfills category/scope/
 * expenseBehavior/source* fields onto whatever transactions already exist in
 * `data` (matched against the embedded 611-row canonical dataset — never
 * creating or deleting a transaction), upserts the real 8-item
 * RecurringExpense catalog, and creates the default "생활비" budget only if
 * none exists yet. Pure function — DataContext is responsible for persisting
 * the result and advancing Settings.dataMigrationVersion once this returns.
 */
export function runDataMigration(data: AppData): { data: AppData; summary: DataMigrationSummary } {
  const { matches, unmatchedRows } = matchCanonicalRows(data.transactions);

  let updated = 0;
  const patchByTransactionId = new Map<string, ReturnType<typeof backfillPatch>>();
  for (const { row, transactionId } of matches) {
    patchByTransactionId.set(transactionId, backfillPatch(row));
  }

  const nextTransactions = data.transactions.map((t) => {
    const patch = patchByTransactionId.get(t.id);
    if (!patch) return t;
    if (!patchDiffers(t, patch)) return t;
    updated++;
    return { ...t, ...patch, updatedAt: nowIso() };
  });

  const categorizedCount = matches.filter(({ row }) => deriveCategoryId(row) !== null).length;
  const uncategorizedCount = matches.length - categorizedCount;

  const fixedCountByMonth: Record<string, number> = {};
  let fixedCount = 0;
  for (const t of nextTransactions) {
    if (t.expenseBehavior === "FIXED") {
      fixedCount++;
      const month = t.date.slice(0, 7);
      fixedCountByMonth[month] = (fixedCountByMonth[month] ?? 0) + 1;
    }
  }

  const { recurringExpenses, upsertedCount } = upsertRecurringExpenseCatalog(data.recurringExpenses);
  const { budgets, created: budgetCreated } = ensureDefaultLivingBudget(data.budgets);

  const summary: DataMigrationSummary = {
    version: DATA_MIGRATION_TARGET_VERSION,
    ranAt: nowIso(),
    transactionsTotal: data.transactions.length,
    canonicalTotal: CANONICAL_TRANSACTIONS_2026.length,
    matched: matches.length,
    unmatched: unmatchedRows.length,
    updated,
    created: 0,
    deleted: 0,
    categorizedCount,
    uncategorizedCount,
    fixedCount,
    fixedCountByMonth,
    recurringExpensesUpserted: upsertedCount,
    budgetCreated,
  };

  return {
    data: { ...data, transactions: nextTransactions, recurringExpenses, budgets },
    summary,
  };
}
