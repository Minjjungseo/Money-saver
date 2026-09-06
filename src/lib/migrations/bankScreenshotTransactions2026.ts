import type { AppData, ExpenseScope, Transaction, TransactionType } from "@/types";
import { findPossibleDuplicate } from "@/lib/duplicateDetection";
import { toMinorUnits } from "@/lib/money";
import { categoryIdFor } from "@/lib/defaultCategories";
import { generateId, nowIso } from "@/lib/id";

export const BANK_SCREENSHOT_MIGRATION_TARGET_VERSION = 1;

interface KnownTransactionSeed {
  date: string;
  merchant: string;
  amountAud: number;
  transactionType: TransactionType;
  categoryId: string | null;
  scope: ExpenseScope | null;
  /** false renders the existing "확인 필요" badge (TransactionRow.tsx) for genuinely uncertain category/nature — never guessed. */
  reviewed: boolean;
  accountNamePattern: RegExp;
  memo: string;
}

/**
 * The 5 real transactions confirmed from two bank-app screenshots (CommBank
 * "Smart Access" and 하나트래블로그, both 2026-09), matched to a real Account
 * by name at run time rather than a hardcoded id. The still-Pending Amazon
 * charge and the cut-off 2026-08-31 row are deliberately NOT here — see
 * addKnownBankScreenshotTransactions's returned pendingExcluded count.
 */
const KNOWN_TRANSACTIONS: KnownTransactionSeed[] = [
  {
    date: "2026-09-02",
    merchant: "Transfer to Bora Choi CommBank app Minjung",
    amountAud: 20.0,
    transactionType: "EXPENSE",
    categoryId: null,
    scope: null,
    reviewed: false,
    accountNamePattern: /commbank/i,
    memo: "CommBank 스크린샷에서 확인 — 사용 목적 확인 필요",
  },
  {
    date: "2026-09-01",
    merchant: "Direct Credit 342189 Nium Minjung Se",
    amountAud: 3030.91,
    transactionType: "TRANSFER",
    categoryId: null,
    scope: "TRANSFER",
    reviewed: false,
    accountNamePattern: /commbank/i,
    memo: "CommBank 스크린샷에서 확인 — Nium 경유 입금, 자산이동으로 추정되나 확정 전까지 확인 필요 (일반 소득으로 자동 분류하지 않음)",
  },
  {
    date: "2026-09-06",
    merchant: "HANARO TRADING PTY LTD",
    amountAud: 7.2,
    transactionType: "EXPENSE",
    categoryId: categoryIdFor("groceries_shopping"),
    scope: null,
    reviewed: true,
    accountNamePattern: /하나트래블로그|하나은행|하나/,
    memo: "하나트래블로그 스크린샷에서 확인",
  },
  {
    date: "2026-09-06",
    merchant: "COLES 4547",
    amountAud: 112.72,
    transactionType: "EXPENSE",
    categoryId: categoryIdFor("groceries_shopping"),
    scope: null,
    reviewed: true,
    accountNamePattern: /하나트래블로그|하나은행|하나/,
    memo: "하나트래블로그 스크린샷에서 확인",
  },
  {
    date: "2026-09-06",
    merchant: "KMART 1159",
    amountAud: 35.0,
    transactionType: "EXPENSE",
    categoryId: categoryIdFor("household"),
    scope: null,
    reviewed: true,
    accountNamePattern: /하나트래블로그|하나은행|하나/,
    memo: "하나트래블로그 스크린샷에서 확인 — 카테고리는 제안값, 확인 후 수정 가능",
  },
];

export interface BankScreenshotAdditionResult {
  transactions: Transaction[];
  added: number;
  duplicatesSkipped: number;
  /** Always 1 — the still-Pending Amazon charge, excluded because the app has no pending-transaction concept; never added, never silently dropped without being counted. */
  pendingExcluded: number;
}

/**
 * Adds the 5 known screenshot transactions to whatever transactions already
 * exist, each checked against the CURRENT list (so a duplicate introduced by
 * this same batch, or by a CSV import that ran moments earlier or later,
 * is caught either way) — never creating a duplicate, never touching or
 * removing anything already there.
 */
export function addKnownBankScreenshotTransactions(data: AppData): BankScreenshotAdditionResult {
  let transactions = [...data.transactions];
  let added = 0;
  let duplicatesSkipped = 0;

  for (const seed of KNOWN_TRANSACTIONS) {
    const account =
      data.accounts.find((a) => seed.accountNamePattern.test(a.name) || seed.accountNamePattern.test(a.bank)) ?? null;
    const amountMinor = toMinorUnits(seed.amountAud, "AUD");
    const duplicate = findPossibleDuplicate(
      { date: seed.date, amountMinor, merchant: seed.merchant, accountId: account?.id ?? null, currency: "AUD" },
      transactions
    );
    if (duplicate) {
      duplicatesSkipped++;
      continue;
    }
    const transaction: Transaction = {
      id: generateId("txn"),
      date: seed.date,
      merchant: seed.merchant,
      amountMinor,
      currency: "AUD",
      transactionType: seed.transactionType,
      categoryId: seed.categoryId,
      subcategory: null,
      accountId: account?.id ?? null,
      memo: seed.memo,
      source: "IMAGE_IMPORT",
      importBatchId: null,
      aiConfidence: null,
      reviewed: seed.reviewed,
      originalFileRef: null,
      scope: seed.scope,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    transactions = [transaction, ...transactions];
    added++;
  }

  return { transactions, added, duplicatesSkipped, pendingExcluded: 1 };
}
