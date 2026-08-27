import type { Category, MerchantRule } from "@/types";

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

/** Best-effort match of a free-text category name (e.g. from an AI guess) to a known category id. */
export function matchCategoryByName(name: string | null | undefined, categories: Category[]): string | null {
  if (!name) return null;
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const exact = categories.find((c) => c.name.toLowerCase() === target);
  if (exact) return exact.id;
  const partial = categories.find(
    (c) => c.name.toLowerCase().includes(target) || target.includes(c.name.toLowerCase())
  );
  return partial?.id ?? null;
}
