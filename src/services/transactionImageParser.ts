import { format } from "date-fns";
import type { Account, Category, CurrencyCode, MerchantRule, ParsedTransactionCandidate, Transaction, TransactionType } from "@/types";
import { toMinorUnits } from "@/lib/money";
import { matchMerchantRule, matchCategoryByName } from "@/lib/merchantRules";
import { findPossibleDuplicate } from "@/lib/duplicateDetection";
import { generateId } from "@/lib/id";

interface RawParsedTransaction {
  date: string | null;
  time: string | null;
  merchant: string | null;
  amount: number | null;
  currency: CurrencyCode | null;
  direction: "IN" | "OUT" | null;
  status: "PENDING" | "SETTLED" | null;
  balanceAfter: number | null;
  truncated: boolean | null;
  transactionTypeGuess: string | null;
  categoryGuess: string | null;
  subcategoryGuess: string | null;
  confidence: number | null;
}

export interface ImageParseContext {
  categories: Category[];
  merchantRules: MerchantRule[];
  accounts: Account[];
  existingTransactions: Transaction[];
}

export interface ImageParseResult {
  provider: "claude-vision" | "mock";
  /** Which bank/app the screenshot appears to be from, if identifiable — used only to pre-fill (never lock) the suggested account. */
  bankHint: string | null;
  candidates: ParsedTransactionCandidate[];
}

const VALID_TYPES: TransactionType[] = ["EXPENSE", "INCOME", "TRANSFER", "EXCHANGE", "REFUND", "CASH_WITHDRAWAL"];

/**
 * Matches a recognized bank/app name from the image to a real Account by
 * name, the same "match by usual bank name" pattern used for money-plan
 * buckets and the bank-screenshot migration — never invents an account,
 * only suggests one that already exists, and the person can always
 * override it in the review step.
 */
const BANK_NAME_PATTERNS: { pattern: RegExp; hint: RegExp }[] = [
  { pattern: /commbank|commonwealth/i, hint: /commbank|commonwealth/i },
  { pattern: /하나트래블로그|하나은행|하나/, hint: /하나트래블로그|하나|hana/i },
  { pattern: /신한/, hint: /신한|shinhan/i },
  { pattern: /현대카드/, hint: /현대카드|hyundai/i },
  { pattern: /k뱅크/i, hint: /k\s*뱅크|kbank/i },
];

/**
 * Pluggable image -> transaction parser. Calls the server-side /api/parse-image
 * route (which uses Claude Vision when ANTHROPIC_API_KEY is configured). Falls
 * back to a local mock parser so the app is fully usable without an API key —
 * results always land in manual review, never straight into the ledger.
 */
export async function parseTransactionImage(
  imageBase64: string,
  mediaType: string,
  context: ImageParseContext
): Promise<ImageParseResult> {
  let raw: RawParsedTransaction[];
  let bankHint: string | null = null;
  let provider: ImageParseResult["provider"];

  try {
    const res = await fetch("/api/parse-image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageBase64, mediaType }),
    });
    const json = await res.json();
    if (json.provider === "claude-vision" && Array.isArray(json.transactions)) {
      raw = json.transactions;
      bankHint = typeof json.bankHint === "string" ? json.bankHint : null;
      provider = "claude-vision";
    } else {
      raw = generateMockTransactions();
      provider = "mock";
    }
  } catch {
    raw = generateMockTransactions();
    provider = "mock";
  }

  const suggestedAccountId = resolveSuggestedAccountId(bankHint, context.accounts);
  const candidates = raw.map((r) => buildCandidate(r, context, suggestedAccountId));
  return { provider, bankHint, candidates };
}

/** Matches bankHint to a real account name; falls back to "exactly one account in that currency" when there's no hint or no match — never guesses beyond those two signals. */
function resolveSuggestedAccountId(bankHint: string | null, accounts: Account[]): string | null {
  if (!bankHint) return null;
  for (const { pattern, hint } of BANK_NAME_PATTERNS) {
    if (!hint.test(bankHint)) continue;
    const match = accounts.find((a) => pattern.test(a.name) || pattern.test(a.bank));
    if (match) return match.id;
  }
  return null;
}

function buildCandidate(
  raw: RawParsedTransaction,
  context: ImageParseContext,
  bankSuggestedAccountId: string | null
): ParsedTransactionCandidate {
  const currency: CurrencyCode = raw.currency === "KRW" ? "KRW" : "AUD";
  const merchant = raw.merchant?.trim() || null;
  const date = isValidIsoDate(raw.date) ? raw.date : null;
  const amountMinor = typeof raw.amount === "number" && raw.amount > 0 ? toMinorUnits(raw.amount, currency) : null;
  const pending = raw.status === "PENDING";

  const reviewReasons: string[] = [];
  if (raw.truncated) reviewReasons.push("이미지에서 일부가 잘려 확인 필요");
  if (!merchant) reviewReasons.push("가맹점을 읽지 못했어요");
  if (amountMinor === null) reviewReasons.push("금액을 확실하게 읽지 못했어요");
  if (!date) reviewReasons.push("날짜를 읽지 못했어요");
  const needsReview = reviewReasons.length > 0;

  const transactionType: TransactionType = VALID_TYPES.includes(raw.transactionTypeGuess as TransactionType)
    ? (raw.transactionTypeGuess as TransactionType)
    : raw.direction === "IN"
      ? "INCOME"
      : "EXPENSE";

  const rule = merchant ? matchMerchantRule(merchant, context.merchantRules) : null;
  const suggestedCategoryId = rule?.categoryId ?? matchCategoryByName(raw.categoryGuess, context.categories);
  const suggestedSubcategory = rule?.subcategory ?? raw.subcategoryGuess ?? null;

  const accountsInCurrency = context.accounts.filter((a) => a.currency === currency);
  const bankHintMatchesCurrency = bankSuggestedAccountId && accountsInCurrency.some((a) => a.id === bankSuggestedAccountId);
  const suggestedAccountId = bankHintMatchesCurrency
    ? bankSuggestedAccountId
    : accountsInCurrency.length === 1
      ? accountsInCurrency[0].id
      : null;

  const baseConfidence = typeof raw.confidence === "number" ? raw.confidence : 60;
  const confidence = needsReview ? Math.min(baseConfidence, 40) : rule ? Math.max(baseConfidence, 90) : baseConfidence;

  // A row that can't yet be identified (no date, or no amount) can't be
  // meaningfully checked for duplicates — never compare against existing
  // data using a guessed/placeholder value.
  const duplicate =
    date && amountMinor !== null && merchant
      ? findPossibleDuplicate(
          { date, amountMinor, merchant, accountId: suggestedAccountId, currency },
          context.existingTransactions
        )
      : null;

  return {
    id: generateId("cand"),
    date,
    time: raw.time?.trim() || null,
    merchant,
    amountMinor,
    currency,
    transactionType,
    pending,
    suggestedCategoryId,
    suggestedSubcategory,
    suggestedAccountId,
    confidence,
    possibleDuplicateOfId: duplicate?.id ?? null,
    needsReview,
    reviewReason: reviewReasons.join(" · ") || null,
  };
}

function isValidIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const MOCK_TEMPLATES: Omit<RawParsedTransaction, "date">[] = [
  {
    time: null,
    merchant: "Woolworths",
    amount: 42.1,
    currency: "AUD",
    direction: "OUT",
    status: "SETTLED",
    balanceAfter: null,
    truncated: false,
    transactionTypeGuess: "EXPENSE",
    categoryGuess: "Groceries",
    subcategoryGuess: null,
    confidence: 55,
  },
  {
    time: null,
    merchant: "Local Cafe",
    amount: 6.5,
    currency: "AUD",
    direction: "OUT",
    status: "SETTLED",
    balanceAfter: null,
    truncated: false,
    transactionTypeGuess: "EXPENSE",
    categoryGuess: "Dining",
    subcategoryGuess: null,
    confidence: 52,
  },
];

/** No Vision API key configured — produce plausible, clearly-low-confidence rows for manual review. */
function generateMockTransactions(): RawParsedTransaction[] {
  const today = format(new Date(), "yyyy-MM-dd");
  return MOCK_TEMPLATES.map((t) => ({ ...t, date: today }));
}
