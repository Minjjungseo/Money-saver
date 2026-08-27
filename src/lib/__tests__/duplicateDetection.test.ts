import { describe, expect, it } from "vitest";
import { findPossibleDuplicate } from "@/lib/duplicateDetection";
import { toMinorUnits } from "@/lib/money";
import type { Transaction } from "@/types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    date: "2026-08-24",
    merchant: "Woolworths",
    amountMinor: toMinorUnits(83.25, "AUD"),
    currency: "AUD",
    transactionType: "EXPENSE",
    categoryId: null,
    subcategory: null,
    accountId: "acc1",
    memo: "",
    source: "MANUAL",
    importBatchId: null,
    aiConfidence: null,
    reviewed: true,
    originalFileRef: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("findPossibleDuplicate", () => {
  it("flags the same screenshot uploaded twice (same date/amount/merchant/account)", () => {
    const existing = [tx({})];
    const dup = findPossibleDuplicate(
      { date: "2026-08-24", amountMinor: toMinorUnits(83.25, "AUD"), merchant: "Woolworths", accountId: "acc1" },
      existing
    );
    expect(dup).not.toBeNull();
  });

  it("does not flag a different amount as a duplicate", () => {
    const existing = [tx({})];
    const dup = findPossibleDuplicate(
      { date: "2026-08-24", amountMinor: toMinorUnits(50, "AUD"), merchant: "Woolworths", accountId: "acc1" },
      existing
    );
    expect(dup).toBeNull();
  });

  it("does not flag a different account as a duplicate", () => {
    const existing = [tx({ accountId: "acc1" })];
    const dup = findPossibleDuplicate(
      { date: "2026-08-24", amountMinor: toMinorUnits(83.25, "AUD"), merchant: "Woolworths", accountId: "acc2" },
      existing
    );
    expect(dup).toBeNull();
  });

  it("tolerates a small date drift within 2 days", () => {
    const existing = [tx({ date: "2026-08-24" })];
    const dup = findPossibleDuplicate(
      { date: "2026-08-25", amountMinor: toMinorUnits(83.25, "AUD"), merchant: "Woolworths", accountId: "acc1" },
      existing
    );
    expect(dup).not.toBeNull();
  });
});
