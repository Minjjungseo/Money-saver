import type { Category, ExpenseBehavior, ExpenseScope, Transaction } from "@/types";
import { categoryIdFor } from "@/lib/defaultCategories";

/**
 * Default ExpenseScope per category id, keyed by the most specific id that
 * matters. Deliberately sparse: most categories (groceries, dining, shopping,
 * ...) carry no override and default to HOUSEHOLD, which is the safe default
 * for day-to-day spend. Subscriptions is intentionally absent here — a
 * subscription's scope depends on WHICH subscription (Figma vs Netflix), not
 * its category, so that distinction is handled by merchant matching below.
 */
const CATEGORY_SCOPE: Partial<Record<string, ExpenseScope>> = {
  [categoryIdFor("housing_rent")]: "SEPARATE",
  [categoryIdFor("kids_school")]: "SEPARATE",
  [categoryIdFor("business")]: "BUSINESS",
};

/**
 * Default ExpenseBehavior per category id. This is the "how often does this
 * recur" axis — kept separate from ExpenseScope so a category like
 * subscriptions can be FIXED regardless of whether the specific merchant
 * turns out to be a household or business expense.
 */
const CATEGORY_BEHAVIOR: Partial<Record<string, ExpenseBehavior>> = {
  [categoryIdFor("housing")]: "FIXED",
  [categoryIdFor("housing_water")]: "FIXED",
  [categoryIdFor("housing_electricity")]: "FIXED",
  [categoryIdFor("housing_gas")]: "FIXED",
  [categoryIdFor("housing_utilities_other")]: "FIXED",
  [categoryIdFor("kids_activities")]: "FIXED",
  [categoryIdFor("car_insurance")]: "FIXED",
  [categoryIdFor("car_rego")]: "FIXED",
  [categoryIdFor("subscriptions")]: "FIXED",
  [categoryIdFor("telecom")]: "FIXED",
};

/**
 * Merchants confirmed as business expenses regardless of which category
 * they were imported under (they came in tagged "Subscriptions", which only
 * says HOW OFTEN they recur, not WHO they belong to). Matched case-insensitively
 * against the transaction's merchant name.
 */
const CONFIRMED_BUSINESS_MERCHANTS = [/anthropic/i, /\bclaude\b/i, /\bfigma\b/i, /\bcanva\b/i, /higgsfield/i];

/**
 * Merchants whose business/household split is genuinely ambiguous (mixed
 * personal and business purchases under one name) — never auto-assigned
 * BUSINESS, but flagged via needsScopeReview() so a person can decide.
 */
const NEEDS_SCOPE_REVIEW_MERCHANTS = [/apple.*app store/i, /appleappstore/i];

/** The top-level ancestor category id for `categoryId`, or null if it can't be resolved. */
function topLevelCategoryId(categoryId: string | null, categoryById: Map<string, Category>): string | null {
  if (!categoryId) return null;
  const category = categoryById.get(categoryId);
  if (!category) return null;
  return category.parentId ?? category.id;
}

function isConfirmedBusinessMerchant(merchant: string): boolean {
  return CONFIRMED_BUSINESS_MERCHANTS.some((re) => re.test(merchant));
}

/** True for a merchant whose business/personal split can't be auto-decided — surface a "확인 필요" cue in the UI. */
export function needsScopeReview(merchant: string): boolean {
  return NEEDS_SCOPE_REVIEW_MERCHANTS.some((re) => re.test(merchant));
}

/**
 * Best-effort ExpenseScope for a transaction with no explicit override:
 * TRANSFER/EXCHANGE transaction types are always TRANSFER; a confirmed
 * business merchant (Claude, Figma, Canva, Higgsfield, ...) wins next,
 * since scope is about WHO the money belongs to, not what category it
 * landed in; otherwise the category decides, defaulting to HOUSEHOLD.
 */
export function inferExpenseScope(
  transaction: Pick<Transaction, "merchant" | "categoryId" | "transactionType">,
  categories: Category[]
): ExpenseScope {
  if (transaction.transactionType === "TRANSFER" || transaction.transactionType === "EXCHANGE") return "TRANSFER";
  if (isConfirmedBusinessMerchant(transaction.merchant)) return "BUSINESS";

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  if (transaction.categoryId && CATEGORY_SCOPE[transaction.categoryId]) return CATEGORY_SCOPE[transaction.categoryId]!;
  const topId = topLevelCategoryId(transaction.categoryId, categoryById);
  if (topId && CATEGORY_SCOPE[topId]) return CATEGORY_SCOPE[topId]!;
  return "HOUSEHOLD";
}

/** Best-effort ExpenseBehavior for a transaction with no explicit override, defaulting to VARIABLE. */
export function inferExpenseBehavior(
  transaction: Pick<Transaction, "categoryId">,
  categories: Category[]
): ExpenseBehavior {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  if (transaction.categoryId && CATEGORY_BEHAVIOR[transaction.categoryId]) return CATEGORY_BEHAVIOR[transaction.categoryId]!;
  const topId = topLevelCategoryId(transaction.categoryId, categoryById);
  if (topId && CATEGORY_BEHAVIOR[topId]) return CATEGORY_BEHAVIOR[topId]!;
  return "VARIABLE";
}

/** The transaction's actual ExpenseScope: its own explicit tag if set, else the inferred default. */
export function resolveExpenseScope(
  transaction: Pick<Transaction, "merchant" | "categoryId" | "transactionType" | "scope">,
  categories: Category[]
): ExpenseScope {
  return transaction.scope ?? inferExpenseScope(transaction, categories);
}

/** The transaction's actual ExpenseBehavior: its own explicit tag if set, else the inferred default. */
export function resolveExpenseBehavior(
  transaction: Pick<Transaction, "categoryId" | "expenseBehavior">,
  categories: Category[]
): ExpenseBehavior {
  return transaction.expenseBehavior ?? inferExpenseBehavior(transaction, categories);
}

/** The four purpose lenses the Transactions screen filters by, plus "ALL". */
export type PurposeFilterKey = "LIVING" | "FIXED" | "BUSINESS" | "SEPARATE" | "ALL";

/** 생활비/고정비 both require HOUSEHOLD scope, split further by FIXED vs VARIABLE|ONE_TIME behavior. */
export function matchesPurposeFilter(
  transaction: Pick<Transaction, "merchant" | "categoryId" | "transactionType" | "scope" | "expenseBehavior">,
  categories: Category[],
  key: PurposeFilterKey
): boolean {
  if (key === "ALL") return true;
  const scope = resolveExpenseScope(transaction, categories);
  if (key === "BUSINESS") return scope === "BUSINESS";
  if (key === "SEPARATE") return scope === "SEPARATE";
  if (scope !== "HOUSEHOLD") return false;
  const behavior = resolveExpenseBehavior(transaction, categories);
  return key === "FIXED" ? behavior === "FIXED" : behavior !== "FIXED";
}

/** Simplified 7-bucket grouping used for the Home screen's "이번 달 생활비 TOP" ranking. */
export type HomeSpendBucket = "GROCERIES" | "DINING" | "SHOPPING" | "TRANSPORT" | "KIDS" | "HEALTH" | "OTHER";

export const HOME_SPEND_BUCKET_LABELS: Record<HomeSpendBucket, string> = {
  GROCERIES: "식료품",
  DINING: "외식·카페",
  SHOPPING: "쇼핑·생활",
  TRANSPORT: "교통·주유",
  KIDS: "육아·교육",
  HEALTH: "건강",
  OTHER: "기타",
};

const CATEGORY_BUCKET: Partial<Record<string, HomeSpendBucket>> = {
  [categoryIdFor("groceries")]: "GROCERIES",
  [categoryIdFor("dining")]: "DINING",
  [categoryIdFor("shopping")]: "SHOPPING",
  [categoryIdFor("household")]: "SHOPPING",
  [categoryIdFor("beauty")]: "SHOPPING",
  [categoryIdFor("car")]: "TRANSPORT",
  [categoryIdFor("kids")]: "KIDS",
  [categoryIdFor("health")]: "HEALTH",
};

/** Which of the 7 simplified Home-screen buckets a category falls under, for HOUSEHOLD/VARIABLE spend only. */
export function homeSpendBucketFor(categoryId: string | null, categories: Category[]): HomeSpendBucket {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  if (categoryId && CATEGORY_BUCKET[categoryId]) return CATEGORY_BUCKET[categoryId]!;
  const topId = topLevelCategoryId(categoryId, categoryById);
  if (topId && CATEGORY_BUCKET[topId]) return CATEGORY_BUCKET[topId]!;
  return "OTHER";
}
