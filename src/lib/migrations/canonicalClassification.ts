import type { ExpenseBehavior, ExpenseScope } from "@/types";
import { categoryIdFor } from "@/lib/defaultCategories";
import type { CanonicalTransactionRow } from "@/data/canonicalTransactions2026";

/**
 * Maps a canonical row's raw Notion "분류" label to a Money OS categoryId.
 * 💸 자산이동 (asset transfer) is deliberately excluded — those 22 rows are
 * asset movements, not spend categories, and are left uncategorized
 * (categoryId null) by design; see deriveCategoryId below.
 */
const CLASSIFICATION_TO_CATEGORY_SLUG: Record<string, string> = {
  "🍽️ 외식·카페": "dining",
  "🛍️ 쇼핑·생활": "shopping",
  "🛒 식료품": "groceries",
  "🚗 교통·차량": "car",
  "👶 육아·교육": "kids",
  "📦 기타": "other",
  "📱 구독·사업": "subscriptions",
  "🏠 주거·공과금": "housing",
  "🍷 주류": "dining",
  "✈️ 이주·정착": "other",
  "💊 건강": "health",
  "👨‍👩‍👧 가족지원": "other",
};

/** Merchants under 🏠 주거·공과금 that are the mortgage/rent payment specifically (not water/electricity/phone). */
const RENT_MERCHANT_PATTERN = /홈론|rent/i;

/** Merchants confirmed as business expenses — mirrors expenseClassification.ts's CONFIRMED_BUSINESS_MERCHANTS. */
const CONFIRMED_BUSINESS_MERCHANTS = [/anthropic/i, /\bclaude\b/i, /\bfigma\b/i, /\bcanva\b/i, /higgsfield/i];

/**
 * The categoryId a canonical row backfills onto a transaction, or null for
 * the 22 자산이동 rows (which must stay uncategorized — never guessed).
 */
export function deriveCategoryId(row: CanonicalTransactionRow): string | null {
  if (row.classification === "💸 자산이동") return null;
  if (row.classification === "🏠 주거·공과금" && RENT_MERCHANT_PATTERN.test(row.merchant)) {
    return categoryIdFor("housing_rent");
  }
  const slug = CLASSIFICATION_TO_CATEGORY_SLUG[row.classification];
  return slug ? categoryIdFor(slug) : categoryIdFor("other");
}

/** 고정변동 → ExpenseBehavior, verbatim per the migration spec. */
export function deriveExpenseBehavior(row: CanonicalTransactionRow): ExpenseBehavior {
  if (row.fixedVariable === "고정") return "FIXED";
  if (row.fixedVariable === "일회성") return "ONE_TIME";
  return "VARIABLE";
}

/**
 * ExpenseScope derived from the row's own 성격/분류/merchant — computed
 * explicitly at migration time (not left to runtime inference) so every
 * backfilled transaction carries an audited, stored scope. Mirrors the
 * precedence in expenseClassification.ts's inferExpenseScope: 자산이동 is
 * always TRANSFER, a confirmed business merchant wins next (scope is about
 * WHO the money belongs to, not its category — Figma/Claude can be BUSINESS
 * *and* FIXED at the same time, a separate axis), then rent is SEPARATE,
 * else HOUSEHOLD.
 */
export function deriveExpenseScope(row: CanonicalTransactionRow): ExpenseScope {
  if (row.nature === "자산이동" || row.classification === "💸 자산이동") return "TRANSFER";
  if (CONFIRMED_BUSINESS_MERCHANTS.some((re) => re.test(row.merchant))) return "BUSINESS";
  if (row.classification === "🏠 주거·공과금" && RENT_MERCHANT_PATTERN.test(row.merchant)) return "SEPARATE";
  return "HOUSEHOLD";
}
