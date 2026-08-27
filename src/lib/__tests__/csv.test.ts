import { describe, expect, it } from "vitest";
import { accountsToCsv, parseAccountsCsv, parseCsv, parseTransactionsCsv, transactionsToCsv } from "@/lib/csv";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";
import { toMinorUnits } from "@/lib/money";
import type { Account, Transaction } from "@/types";

describe("parseCsv", () => {
  it("splits simple comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with embedded commas and escaped quotes", () => {
    const rows = parseCsv('name,note\n"Smith, John","He said ""hi"""');
    expect(rows[1]).toEqual(["Smith, John", 'He said "hi"']);
  });
});

describe("transactions CSV round trip", () => {
  const categories = buildDefaultCategories();
  const account: Account = {
    id: "acc1",
    name: "Everyday",
    bank: "CBA",
    currency: "AUD",
    balanceMinor: toMinorUnits(1000, "AUD"),
    type: "CHECKING",
    includeInAvailable: true,
    createdAt: "",
    updatedAt: "",
  };
  const transaction: Transaction = {
    id: "t1",
    date: "2026-08-24",
    merchant: "Woolworths",
    amountMinor: toMinorUnits(83.25, "AUD"),
    currency: "AUD",
    transactionType: "EXPENSE",
    categoryId: categoryIdFor("groceries"),
    subcategory: null,
    accountId: "acc1",
    memo: "weekly shop",
    source: "MANUAL",
    importBatchId: null,
    aiConfidence: null,
    reviewed: true,
    originalFileRef: null,
    createdAt: "",
    updatedAt: "",
  };

  it("exports and re-parses a transaction without losing data", () => {
    const csv = transactionsToCsv([transaction], categories, [account]);
    const { rows, errors } = parseTransactionsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-08-24",
      merchant: "Woolworths",
      amountMinor: toMinorUnits(83.25, "AUD"),
      currency: "AUD",
      transactionType: "EXPENSE",
      categoryName: "Groceries",
      accountName: "Everyday",
      memo: "weekly shop",
    });
  });

  it("reports errors for invalid rows instead of throwing", () => {
    const { rows, errors } = parseTransactionsCsv("date,merchant,amount,currency\nnot-a-date,X,10,AUD\n2026-08-01,Y,notanumber,AUD");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });
});

describe("accounts CSV round trip", () => {
  it("exports and re-parses an account without losing data", () => {
    const account: Account = {
      id: "acc1",
      name: "Korean Account",
      bank: "KB Kookmin",
      currency: "KRW",
      balanceMinor: toMinorUnits(3200000, "KRW"),
      type: "SAVINGS",
      includeInAvailable: true,
      createdAt: "",
      updatedAt: "",
    };
    const csv = accountsToCsv([account]);
    const { rows, errors } = parseAccountsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      name: "Korean Account",
      bank: "KB Kookmin",
      currency: "KRW",
      balanceMinor: toMinorUnits(3200000, "KRW"),
      type: "SAVINGS",
      includeInAvailable: true,
    });
  });
});
