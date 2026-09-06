import { describe, expect, it } from "vitest";
import type { Account, AppData, Transaction } from "@/types";
import { toMinorUnits } from "@/lib/money";
import { categoryIdFor } from "@/lib/defaultCategories";
import { addKnownBankScreenshotTransactions } from "../bankScreenshotTransactions2026";

function account(partial: Partial<Account>): Account {
  return {
    id: "acc",
    name: "",
    bank: "",
    currency: "AUD",
    balanceMinor: 0,
    balanceAsOfDate: "2026-09-06",
    type: "CHECKING",
    includeInAvailable: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function baseData(overrides: Partial<AppData> = {}): AppData {
  return {
    accounts: [],
    transactions: [],
    categories: [],
    recurringExpenses: [],
    plannedExpenses: [],
    plannedIncomes: [],
    budgets: [],
    importBatches: [],
    merchantRules: [],
    exchangeRates: [{ pair: "AUD_KRW", rate: 978, updatedAt: "2026-01-01T00:00:00.000Z" }],
    settings: {} as AppData["settings"],
    moneyPlans: [],
    moneyPlanBucketConfig: { koreaCardAccountId: null, auFixedAccountId: null, livingAccountId: null, reserveAccountId: null },
    ...overrides,
  };
}

const commbank = account({ id: "acc_commbank", name: "CommBank", bank: "CommBank" });
const hana = account({ id: "acc_hana", name: "하나트래블로그", bank: "하나은행" });

describe("addKnownBankScreenshotTransactions", () => {
  it("adds all 5 confirmed transactions and reports the Pending Amazon charge as excluded", () => {
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana] }));
    expect(result.added).toBe(5);
    expect(result.duplicatesSkipped).toBe(0);
    expect(result.pendingExcluded).toBe(1);
    expect(result.transactions).toHaveLength(5);
  });

  it("never creates an Amazon transaction of any kind", () => {
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana] }));
    expect(result.transactions.some((t) => /amazon/i.test(t.merchant))).toBe(false);
  });

  it("never creates a transaction for the cut-off 2026-08-31 row", () => {
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana] }));
    expect(result.transactions.every((t) => t.date !== "2026-08-31")).toBe(true);
  });

  it("marks the Bora Choi transfer and the Nium credit as needing review, never guessing category/type", () => {
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana] }));
    const bora = result.transactions.find((t) => /bora choi/i.test(t.merchant));
    const nium = result.transactions.find((t) => /nium/i.test(t.merchant));
    expect(bora).toMatchObject({ reviewed: false, categoryId: null, transactionType: "EXPENSE", amountMinor: toMinorUnits(20, "AUD") });
    expect(nium).toMatchObject({ reviewed: false, categoryId: null, transactionType: "TRANSFER", scope: "TRANSFER", amountMinor: toMinorUnits(3030.91, "AUD") });
    // Never classified as plain INCOME per spec ("일반 급여/소득으로 자동 분류하지 않는다").
    expect(nium?.transactionType).not.toBe("INCOME");
  });

  it("attaches the CommBank transactions to the matched CommBank account and Hana ones to 하나트래블로그", () => {
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana] }));
    const bora = result.transactions.find((t) => /bora choi/i.test(t.merchant));
    const nium = result.transactions.find((t) => /nium/i.test(t.merchant));
    const hanaro = result.transactions.find((t) => /hanaro/i.test(t.merchant));
    expect(bora?.accountId).toBe(commbank.id);
    expect(nium?.accountId).toBe(commbank.id);
    expect(hanaro?.accountId).toBe(hana.id);
  });

  it("confirms the three Hana transactions are reviewed with sensible categories", () => {
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana] }));
    const hanaro = result.transactions.find((t) => /hanaro/i.test(t.merchant));
    const coles = result.transactions.find((t) => /coles/i.test(t.merchant));
    const kmart = result.transactions.find((t) => /kmart/i.test(t.merchant));
    expect(hanaro).toMatchObject({ reviewed: true, categoryId: categoryIdFor("groceries_shopping"), amountMinor: toMinorUnits(7.2, "AUD") });
    expect(coles).toMatchObject({ reviewed: true, categoryId: categoryIdFor("groceries_shopping"), amountMinor: toMinorUnits(112.72, "AUD") });
    expect(kmart).toMatchObject({ reviewed: true, categoryId: categoryIdFor("household"), amountMinor: toMinorUnits(35, "AUD") });
  });

  it("is idempotent: running twice never duplicates any of the 5 transactions", () => {
    const first = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana] }));
    const second = addKnownBankScreenshotTransactions({ ...baseData({ accounts: [commbank, hana] }), transactions: first.transactions });
    expect(second.added).toBe(0);
    expect(second.duplicatesSkipped).toBe(5);
    expect(second.transactions).toHaveLength(5);
  });

  it("skips a transaction that already exists from another source (e.g. a prior CSV import) instead of duplicating it", () => {
    const existing: Transaction = {
      id: "txn_existing",
      date: "2026-09-02",
      merchant: "Transfer to Bora Choi CommBank app Minjung",
      amountMinor: toMinorUnits(20, "AUD"),
      currency: "AUD",
      transactionType: "EXPENSE",
      categoryId: null,
      subcategory: null,
      accountId: commbank.id,
      memo: "",
      source: "CSV_IMPORT",
      importBatchId: null,
      aiConfidence: null,
      reviewed: true,
      originalFileRef: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [commbank, hana], transactions: [existing] }));
    expect(result.duplicatesSkipped).toBe(1);
    expect(result.added).toBe(4);
    // The pre-existing transaction is untouched, not replaced.
    expect(result.transactions.filter((t) => /bora choi/i.test(t.merchant))).toHaveLength(1);
    expect(result.transactions.find((t) => /bora choi/i.test(t.merchant))?.id).toBe("txn_existing");
  });

  it("leaves accountId null when no matching account exists, rather than guessing one", () => {
    const result = addKnownBankScreenshotTransactions(baseData({ accounts: [] }));
    expect(result.added).toBe(5);
    expect(result.transactions.every((t) => t.accountId === null)).toBe(true);
  });
});
