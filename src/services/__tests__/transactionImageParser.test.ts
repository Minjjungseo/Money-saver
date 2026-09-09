import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Account, Category, MerchantRule, Transaction } from "@/types";
import { toMinorUnits } from "@/lib/money";
import { buildDefaultCategories } from "@/lib/defaultCategories";
import { parseTransactionImage, type ImageParseContext } from "../transactionImageParser";

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

const commbank = account({ id: "acc_commbank", name: "CommBank", bank: "CommBank" });
const hana = account({ id: "acc_hana", name: "하나트래블로그", bank: "하나은행" });

function baseContext(overrides: Partial<ImageParseContext> = {}): ImageParseContext {
  return {
    categories: buildDefaultCategories() as Category[],
    merchantRules: [] as MerchantRule[],
    accounts: [commbank, hana],
    existingTransactions: [] as Transaction[],
    ...overrides,
  };
}

function mockFetchOnce(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => body,
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseTransactionImage — 하나트래블로그 screenshot (3 real rows)", () => {
  const HANA_ROWS = [
    {
      date: "2026-09-06", time: "12:31", merchant: "HANARO TRADING PTY LTD", amount: 7.2, currency: "AUD",
      direction: "OUT", status: "SETTLED", balanceAfter: 275.75, truncated: false,
      transactionTypeGuess: "EXPENSE", categoryGuess: "Groceries", subcategoryGuess: null, confidence: 92,
    },
    {
      date: "2026-09-06", time: "12:25", merchant: "COLES 4547", amount: 112.72, currency: "AUD",
      direction: "OUT", status: "SETTLED", balanceAfter: 282.95, truncated: false,
      transactionTypeGuess: "EXPENSE", categoryGuess: "Groceries", subcategoryGuess: null, confidence: 95,
    },
    {
      date: "2026-09-06", time: "12:12", merchant: "KMART 1159", amount: 35.0, currency: "AUD",
      direction: "OUT", status: "SETTLED", balanceAfter: 395.67, truncated: false,
      transactionTypeGuess: "EXPENSE", categoryGuess: "Shopping", subcategoryGuess: null, confidence: 88,
    },
  ];

  beforeEach(() => {
    mockFetchOnce({ provider: "claude-vision", bankHint: "하나트래블로그", transactions: HANA_ROWS });
  });

  it("extracts all 3 visible transaction blocks — not just the first", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.provider).toBe("claude-vision");
    expect(result.candidates).toHaveLength(3);
  });

  it("totals exactly A$154.92 across the 3 rows", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    const total = result.candidates.reduce((sum, c) => sum + (c.amountMinor ?? 0), 0);
    expect(total).toBe(toMinorUnits(154.92, "AUD"));
  });

  it("reads amount from the amount field, never from balanceAfter", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    const hanaro = result.candidates.find((c) => c.merchant === "HANARO TRADING PTY LTD");
    expect(hanaro?.amountMinor).toBe(toMinorUnits(7.2, "AUD")); // not 27575 (the balanceAfter)
  });

  it("preserves the time field for each row", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    const times = result.candidates.map((c) => c.time);
    expect(times).toEqual(["12:31", "12:25", "12:12"]);
  });

  it("suggests the 하나트래블로그 account by its full display name from the bankHint, matched to the real account", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.bankHint).toBe("하나트래블로그");
    for (const c of result.candidates) {
      expect(c.suggestedAccountId).toBe(hana.id);
    }
  });

  it("marks none of the 3 rows as needing review (all fields were clean)", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.candidates.every((c) => !c.needsReview)).toBe(true);
    expect(result.candidates.every((c) => !c.pending)).toBe(true);
  });
});

describe("parseTransactionImage — CommBank screenshot", () => {
  const COMMBANK_ROWS = [
    {
      date: "2026-09-06", time: null, merchant: "Amazon", amount: 125.37, currency: "AUD",
      direction: "OUT", status: "PENDING", balanceAfter: null, truncated: false,
      transactionTypeGuess: "EXPENSE", categoryGuess: "Shopping", subcategoryGuess: null, confidence: 90,
    },
    {
      date: "2026-09-01", time: null, merchant: "Direct Credit 342189 Nium Minjung Se", amount: 3030.91, currency: "AUD",
      direction: "IN", status: "SETTLED", balanceAfter: null, truncated: false,
      transactionTypeGuess: "TRANSFER", categoryGuess: "Other", subcategoryGuess: null, confidence: 80,
    },
    // Row cut off at the bottom of the screenshot — merchant/amount not fully visible.
    {
      date: "2026-08-31", time: null, merchant: null, amount: null, currency: "AUD",
      direction: null, status: "SETTLED", balanceAfter: null, truncated: true,
      transactionTypeGuess: null, categoryGuess: null, subcategoryGuess: null, confidence: 20,
    },
  ];

  beforeEach(() => {
    mockFetchOnce({ provider: "claude-vision", bankHint: "CommBank", transactions: COMMBANK_ROWS });
  });

  it("extracts the pending Amazon row and marks it pending, never as a confirmed expense", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    const amazon = result.candidates.find((c) => c.merchant === "Amazon");
    expect(amazon?.pending).toBe(true);
    expect(amazon?.amountMinor).toBe(toMinorUnits(125.37, "AUD"));
  });

  it("reads the Direct Credit as IN direction / TRANSFER, not defaulted to EXPENSE", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    const credit = result.candidates.find((c) => c.merchant?.includes("Nium"));
    expect(credit?.transactionType).toBe("TRANSFER");
    expect(credit?.amountMinor).toBe(toMinorUnits(3030.91, "AUD"));
  });

  it("keeps the truncated/cut-off row instead of dropping it, flagged as needing review with null merchant/amount", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.candidates).toHaveLength(3); // never silently dropped
    const cutOff = result.candidates.find((c) => c.date === "2026-08-31");
    expect(cutOff).toBeDefined();
    expect(cutOff?.merchant).toBeNull();
    expect(cutOff?.amountMinor).toBeNull();
    expect(cutOff?.needsReview).toBe(true);
    expect(cutOff?.reviewReason).toBeTruthy();
  });

  it("suggests CommBank as the account via bankHint", async () => {
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.candidates.every((c) => c.suggestedAccountId === commbank.id)).toBe(true);
  });
});

describe("parseTransactionImage — structural validation / never-guess rules", () => {
  it("never defaults a missing amount to 0 — leaves it null and flags needsReview", async () => {
    mockFetchOnce({
      provider: "claude-vision",
      bankHint: null,
      transactions: [
        {
          date: "2026-09-02", time: "10:00", merchant: "Some Shop", amount: null, currency: "AUD",
          direction: "OUT", status: "SETTLED", balanceAfter: null, truncated: false,
          transactionTypeGuess: "EXPENSE", categoryGuess: null, subcategoryGuess: null, confidence: 40,
        },
      ],
    });
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.candidates[0].amountMinor).toBeNull();
    expect(result.candidates[0].needsReview).toBe(true);
  });

  it("never defaults a missing merchant to a placeholder string like 'Unknown merchant'", async () => {
    mockFetchOnce({
      provider: "claude-vision",
      bankHint: null,
      transactions: [
        {
          date: "2026-09-02", time: "10:00", merchant: null, amount: 12.5, currency: "AUD",
          direction: "OUT", status: "SETTLED", balanceAfter: null, truncated: false,
          transactionTypeGuess: "EXPENSE", categoryGuess: null, subcategoryGuess: null, confidence: 40,
        },
      ],
    });
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.candidates[0].merchant).toBeNull();
    expect(result.candidates[0].needsReview).toBe(true);
  });

  it("does not compute a duplicate match against a candidate that's still missing date/merchant/amount", async () => {
    const existing: Transaction = {
      id: "txn_1", date: "2026-09-02", merchant: "Some Shop", amountMinor: 1250, currency: "AUD",
      transactionType: "EXPENSE", categoryId: null, subcategory: null, accountId: null, memo: "",
      source: "MANUAL", importBatchId: null, aiConfidence: null, reviewed: true, originalFileRef: null,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockFetchOnce({
      provider: "claude-vision",
      bankHint: null,
      transactions: [
        {
          date: "2026-09-02", time: null, merchant: null, amount: 12.5, currency: "AUD",
          direction: "OUT", status: "SETTLED", balanceAfter: null, truncated: true,
          transactionTypeGuess: "EXPENSE", categoryGuess: null, subcategoryGuess: null, confidence: 20,
        },
      ],
    });
    const result = await parseTransactionImage("base64", "image/png", baseContext({ existingTransactions: [existing] }));
    expect(result.candidates[0].possibleDuplicateOfId).toBeNull();
  });

  it("flags a duplicate only within the same currency (same numeric amount, different currency, is not a duplicate)", async () => {
    const existing: Transaction = {
      id: "txn_krw", date: "2026-09-02", merchant: "Coles", amountMinor: 100, currency: "KRW",
      transactionType: "EXPENSE", categoryId: null, subcategory: null, accountId: null, memo: "",
      source: "MANUAL", importBatchId: null, aiConfidence: null, reviewed: true, originalFileRef: null,
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mockFetchOnce({
      provider: "claude-vision",
      bankHint: null,
      transactions: [
        {
          date: "2026-09-02", time: null, merchant: "Coles", amount: 1.0, currency: "AUD",
          direction: "OUT", status: "SETTLED", balanceAfter: null, truncated: false,
          transactionTypeGuess: "EXPENSE", categoryGuess: null, subcategoryGuess: null, confidence: 80,
        },
      ],
    });
    const result = await parseTransactionImage("base64", "image/png", baseContext({ existingTransactions: [existing] }));
    // AUD 1.00 (100 minor) vs KRW 100 (100 minor) — same numeric minor amount, different currency.
    expect(result.candidates[0].possibleDuplicateOfId).toBeNull();
  });

  it("falls back to the mock provider when fetch fails, and mock rows are never marked needsReview/pending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await parseTransactionImage("base64", "image/png", baseContext());
    expect(result.provider).toBe("mock");
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.every((c) => !c.needsReview)).toBe(true);
  });
});
