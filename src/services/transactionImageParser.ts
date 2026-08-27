import { format } from "date-fns";
import type { Account, Category, CurrencyCode, MerchantRule, ParsedTransactionCandidate, Transaction, TransactionType } from "@/types";
import { toMinorUnits } from "@/lib/money";
import { matchMerchantRule, matchCategoryByName } from "@/lib/merchantRules";
import { findPossibleDuplicate } from "@/lib/duplicateDetection";
import { generateId } from "@/lib/id";

interface RawParsedTransaction {
  date: string | null;
  merchant: string | null;
  amount: number | null;
  currency: CurrencyCode | null;
  direction: "IN" | "OUT" | null;
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
  candidates: ParsedTransactionCandidate[];
}

const VALID_TYPES: TransactionType[] = ["EXPENSE", "INCOME", "TRANSFER", "EXCHANGE", "REFUND", "CASH_WITHDRAWAL"];

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
      provider = "claude-vision";
    } else {
      raw = generateMockTransactions();
      provider = "mock";
    }
  } catch {
    raw = generateMockTransactions();
    provider = "mock";
  }

  const candidates = raw.map((r) => buildCandidate(r, context));
  return { provider, candidates };
}

function buildCandidate(raw: RawParsedTransaction, context: ImageParseContext): ParsedTransactionCandidate {
  const currency: CurrencyCode = raw.currency === "KRW" ? "KRW" : "AUD";
  const merchant = raw.merchant?.trim() || "Unknown merchant";
  const date = isValidIsoDate(raw.date) ? raw.date! : format(new Date(), "yyyy-MM-dd");
  const amountMinor = toMinorUnits(Math.abs(raw.amount ?? 0), currency);

  const transactionType: TransactionType = VALID_TYPES.includes(raw.transactionTypeGuess as TransactionType)
    ? (raw.transactionTypeGuess as TransactionType)
    : raw.direction === "IN"
      ? "INCOME"
      : "EXPENSE";

  const rule = matchMerchantRule(merchant, context.merchantRules);
  const suggestedCategoryId = rule?.categoryId ?? matchCategoryByName(raw.categoryGuess, context.categories);
  const suggestedSubcategory = rule?.subcategory ?? raw.subcategoryGuess ?? null;

  const accountsInCurrency = context.accounts.filter((a) => a.currency === currency);
  const suggestedAccountId = accountsInCurrency.length === 1 ? accountsInCurrency[0].id : null;

  const baseConfidence = typeof raw.confidence === "number" ? raw.confidence : 60;
  const confidence = rule ? Math.max(baseConfidence, 90) : baseConfidence;

  const duplicate = findPossibleDuplicate(
    { date, amountMinor, merchant, accountId: suggestedAccountId },
    context.existingTransactions
  );

  return {
    id: generateId("cand"),
    date,
    merchant,
    amountMinor,
    currency,
    transactionType,
    suggestedCategoryId,
    suggestedSubcategory,
    suggestedAccountId,
    confidence,
    possibleDuplicateOfId: duplicate?.id ?? null,
  };
}

function isValidIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const MOCK_TEMPLATES: Omit<RawParsedTransaction, "date">[] = [
  {
    merchant: "Woolworths",
    amount: 42.1,
    currency: "AUD",
    direction: "OUT",
    transactionTypeGuess: "EXPENSE",
    categoryGuess: "Groceries",
    subcategoryGuess: null,
    confidence: 55,
  },
  {
    merchant: "Local Cafe",
    amount: 6.5,
    currency: "AUD",
    direction: "OUT",
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
