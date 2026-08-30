import type { BudgetNature, Category, Transaction } from "@/types";
import { categoryIdFor } from "@/lib/defaultCategories";

/**
 * Default BudgetNature per category id, keyed by the most specific id that
 * matters — a child category id (e.g. rent) overrides its parent's default.
 * Anything not listed here falls back to LIVING, since day-to-day variable
 * spend is the common case and the safest default when a category is unknown.
 */
const CATEGORY_NATURE: Partial<Record<string, BudgetNature>> = {
  [categoryIdFor("housing")]: "FIXED",
  [categoryIdFor("housing_rent")]: "SEPARATE",
  [categoryIdFor("housing_water")]: "FIXED",
  [categoryIdFor("housing_electricity")]: "FIXED",
  [categoryIdFor("housing_gas")]: "FIXED",
  [categoryIdFor("housing_utilities_other")]: "FIXED",
  [categoryIdFor("kids_school")]: "SEPARATE",
  [categoryIdFor("kids_activities")]: "FIXED",
  [categoryIdFor("car_insurance")]: "FIXED",
  [categoryIdFor("car_rego")]: "FIXED",
  [categoryIdFor("subscriptions")]: "FIXED",
  [categoryIdFor("telecom")]: "FIXED",
  [categoryIdFor("business")]: "BUSINESS",
};

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

/** The top-level ancestor category id for `categoryId`, or null if it can't be resolved. */
function topLevelCategoryId(categoryId: string | null, categoryById: Map<string, Category>): string | null {
  if (!categoryId) return null;
  const category = categoryById.get(categoryId);
  if (!category) return null;
  return category.parentId ?? category.id;
}

/**
 * Best-effort BudgetNature for a transaction that has no explicit override:
 * asset-moving transaction types are always TRANSFER regardless of category,
 * a TRANSFER/EXCHANGE-typed transaction is always TRANSFER; otherwise the
 * category (its specific id, or its parent) decides, defaulting to LIVING.
 */
export function inferBudgetNature(
  transaction: Pick<Transaction, "categoryId" | "transactionType">,
  categories: Category[]
): BudgetNature {
  if (transaction.transactionType === "TRANSFER" || transaction.transactionType === "EXCHANGE") return "TRANSFER";

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  if (transaction.categoryId && CATEGORY_NATURE[transaction.categoryId]) {
    return CATEGORY_NATURE[transaction.categoryId]!;
  }
  const topId = topLevelCategoryId(transaction.categoryId, categoryById);
  if (topId && CATEGORY_NATURE[topId]) return CATEGORY_NATURE[topId]!;
  return "LIVING";
}

/** The transaction's actual BudgetNature: its own explicit tag if set, else the inferred default. */
export function resolveBudgetNature(
  transaction: Pick<Transaction, "categoryId" | "transactionType" | "budgetNature">,
  categories: Category[]
): BudgetNature {
  return transaction.budgetNature ?? inferBudgetNature(transaction, categories);
}

/** Which of the 7 simplified Home-screen buckets a category falls under, for LIVING-nature spend only. */
export function homeSpendBucketFor(categoryId: string | null, categories: Category[]): HomeSpendBucket {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  if (categoryId && CATEGORY_BUCKET[categoryId]) return CATEGORY_BUCKET[categoryId]!;
  const topId = topLevelCategoryId(categoryId, categoryById);
  if (topId && CATEGORY_BUCKET[topId]) return CATEGORY_BUCKET[topId]!;
  return "OTHER";
}
