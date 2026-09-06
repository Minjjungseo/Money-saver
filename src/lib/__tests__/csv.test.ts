import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { accountsToCsv, parseAccountsCsv, parseCsv, parseTransactionsCsv, transactionsToCsv } from "@/lib/csv";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";
import { matchCategoryByName } from "@/lib/merchantRules";
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
    balanceAsOfDate: null,
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
      categoryName: "식비",
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
      balanceAsOfDate: "2026-08-19",
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
      balanceAsOfDate: "2026-08-19",
      type: "SAVINGS",
      includeInAvailable: true,
    });
  });
});

describe("real Korean-header transaction CSV (호주_가계부_2026-09-02_09-04.csv)", () => {
  const csvText = readFileSync(join(__dirname, "fixtures", "호주_가계부_2026-09-02_09-04.csv"), "utf-8");
  const categories = buildDefaultCategories();

  it("parses all 11 rows with zero errors, despite the UTF-8 BOM and Korean headers", () => {
    const result = parseTransactionsCsv(csvText);
    expect(result.errors).toEqual([]);
    expect(result.totalDataRows).toBe(11);
    expect(result.rows).toHaveLength(11);
  });

  it("has no account column, so the UI must ask which account these belong to", () => {
    const result = parseTransactionsCsv(csvText);
    expect(result.hasAccountColumn).toBe(false);
    for (const row of result.rows) {
      expect(row.accountName).toBe("");
    }
  });

  it("totals exactly A$582.70 across the 11 rows", () => {
    const result = parseTransactionsCsv(csvText);
    const totalMinor = result.rows.reduce((sum, r) => sum + r.amountMinor, 0);
    expect(totalMinor).toBe(toMinorUnits(582.7, "AUD"));
  });

  it("matches every row's date/merchant/amount against the user-verified values", () => {
    const result = parseTransactionsCsv(csvText);
    const expected = [
      { date: "2026-09-02", time: "07:20", merchant: "ASPLEY EAST STATE SCHO", amount: 5.0 },
      { date: "2026-09-02", time: "16:01", merchant: "KMART 1218", amount: 3.75 },
      { date: "2026-09-02", time: "16:25", merchant: "COLES 4670", amount: 109.7 },
      { date: "2026-09-02", time: "16:35", merchant: "BWS 2104", amount: 51.5 },
      { date: "2026-09-03", time: "06:20", merchant: "BP EDINBURGH CASTLE 42", amount: 70.0 },
      { date: "2026-09-03", time: "08:03", merchant: "MCDONALDS ARATULA", amount: 1.5 },
      { date: "2026-09-03", time: "10:00", merchant: "HI VALUE FRUIT &", amount: 73.0 },
      { date: "2026-09-03", time: "16:49", merchant: "HYEKYEONG KANG", amount: 12.39 },
      { date: "2026-09-04", time: "09:19", merchant: "LS*GraniteBeltChristm", amount: 135.0 },
      { date: "2026-09-04", time: "09:32", merchant: "LS*GraniteBeltChristm", amount: 57.86 },
      { date: "2026-09-04", time: "11:27", merchant: "THE GRANITE BELT MAZE", amount: 63.0 },
    ];
    expect(result.rows).toHaveLength(expected.length);
    expected.forEach((exp, i) => {
      expect(result.rows[i]).toMatchObject({
        date: exp.date,
        time: exp.time,
        merchant: exp.merchant,
        amountMinor: toMinorUnits(exp.amount, "AUD"),
        currency: "AUD",
        transactionType: "EXPENSE",
      });
    });
  });

  it("preserves the original 분류 text verbatim in sourceClassification", () => {
    const result = parseTransactionsCsv(csvText);
    expect(result.rows[0].sourceClassification).toBe("교육/학교");
    expect(result.rows[0].categoryName).toBe("교육/학교");
  });

  it("maps every original 분류 label to the correct Money OS top-level category", () => {
    const result = parseTransactionsCsv(csvText);
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const topLevelName = (categoryId: string | null) => {
      if (!categoryId) return null;
      const cat = categoryById.get(categoryId);
      if (!cat) return null;
      return cat.parentId ? categoryById.get(cat.parentId)?.name : cat.name;
    };
    const expectedTopLevel = ["아이", "생활용품", "식비", "식비", "차량", "외식", "식비", "기타", "여행", "여행", "여행"];
    result.rows.forEach((row, i) => {
      const categoryId = matchCategoryByName(row.categoryName, categories);
      expect(topLevelName(categoryId)).toBe(expectedTopLevel[i]);
    });
  });
});

