import type { Category, MerchantRule } from "@/types";
import { categoryIdFor } from "@/lib/defaultCategories";

/**
 * Aliases for category names from older exports/CSVs that predate the
 * current Korean category tree. Notion's transaction export (and any CSV
 * derived from it) still uses these old English top-level names, which
 * would otherwise fail to match any current Korean category name and
 * silently fall back to "기타" for every row. Checked before the generic
 * name matcher below, which only understands the current Korean names.
 */
const LEGACY_CATEGORY_NAME_ALIASES: Record<string, string> = {
  housing: categoryIdFor("housing"),
  groceries: categoryIdFor("groceries"),
  dining: categoryIdFor("dining"),
  kids: categoryIdFor("kids"),
  car: categoryIdFor("car"),
  shopping: categoryIdFor("shopping"),
  health: categoryIdFor("health"),
  subscriptions: categoryIdFor("subscriptions"),
  other: categoryIdFor("other"),
};

/**
 * Highest-confidence merchant rule that matches this merchant name, if any.
 * Rules accumulate confidence every time a user confirms/corrects a category
 * for that merchant, so repeated corrections win out over the AI's own guess.
 */
export function matchMerchantRule(merchant: string, rules: MerchantRule[]): MerchantRule | null {
  const key = merchant.trim().toUpperCase();
  const matches = rules.filter((r) => key.includes(r.merchantPattern) || r.merchantPattern.includes(key));
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.confidence - a.confidence)[0];
}

/**
 * Best-effort match of a free-text category name (e.g. from an AI guess, or
 * a CSV's category column) to a known category id. Tries a legacy-name
 * alias first (see LEGACY_CATEGORY_NAME_ALIASES), then the current Korean
 * category names.
 */
export function matchCategoryByName(name: string | null | undefined, categories: Category[]): string | null {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  if (!target) return null;

  const aliasId = LEGACY_CATEGORY_NAME_ALIASES[target];
  if (aliasId && categories.some((c) => c.id === aliasId)) return aliasId;

  const exact = categories.find((c) => c.name.toLowerCase() === target);
  if (exact) return exact.id;
  const partial = categories.find(
    (c) => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase())
  );
  return partial?.id ?? null;
}
