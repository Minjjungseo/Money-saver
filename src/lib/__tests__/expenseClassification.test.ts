import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";
import {
  homeSpendBucketFor,
  inferExpenseBehavior,
  inferExpenseScope,
  needsScopeReview,
  resolveExpenseBehavior,
  resolveExpenseScope,
} from "@/lib/expenseClassification";

const categories = buildDefaultCategories();

function tx(
  partial: Partial<Transaction>
): Pick<Transaction, "merchant" | "categoryId" | "transactionType" | "scope" | "expenseBehavior"> {
  return {
    merchant: "Test Merchant",
    categoryId: null,
    transactionType: "EXPENSE",
    scope: null,
    expenseBehavior: null,
    ...partial,
  };
}

describe("inferExpenseScope", () => {
  it("confirms Claude/Anthropic, Figma, Canva, and Higgsfield as BUSINESS regardless of category", () => {
    const subs = categoryIdFor("subscriptions");
    expect(inferExpenseScope(tx({ merchant: "Anthropic (Claude 구독)", categoryId: subs }), categories)).toBe("BUSINESS");
    expect(inferExpenseScope(tx({ merchant: "AnthropicClaude", categoryId: subs }), categories)).toBe("BUSINESS");
    expect(inferExpenseScope(tx({ merchant: "FIGMA", categoryId: subs }), categories)).toBe("BUSINESS");
    expect(inferExpenseScope(tx({ merchant: "Figma", categoryId: subs }), categories)).toBe("BUSINESS");
    expect(inferExpenseScope(tx({ merchant: "Canva환불", categoryId: subs }), categories)).toBe("BUSINESS");
    expect(inferExpenseScope(tx({ merchant: "Higgsfield Inc.", categoryId: subs }), categories)).toBe("BUSINESS");
  });

  it("does not force Apple App Store, Amazon Prime, or YouTube Premium to BUSINESS", () => {
    const subs = categoryIdFor("subscriptions");
    expect(inferExpenseScope(tx({ merchant: "Apple (App Store)", categoryId: subs }), categories)).toBe("HOUSEHOLD");
    expect(inferExpenseScope(tx({ merchant: "AppleAppStore1", categoryId: subs }), categories)).toBe("HOUSEHOLD");
    expect(inferExpenseScope(tx({ merchant: "Amazon Prime Membership", categoryId: subs }), categories)).toBe("HOUSEHOLD");
    expect(inferExpenseScope(tx({ merchant: "GOOGLE*YOUTUBE PREMIUM", categoryId: subs }), categories)).toBe("HOUSEHOLD");
  });

  it("flags Apple App Store as needing scope review but not Amazon Prime or YouTube", () => {
    expect(needsScopeReview("Apple (App Store)")).toBe(true);
    expect(needsScopeReview("AppleAppStore1")).toBe(true);
    expect(needsScopeReview("Amazon Prime Membership")).toBe(false);
    expect(needsScopeReview("GOOGLE*YOUTUBE PREMIUM")).toBe(false);
  });

  it("treats rent and school tuition as SEPARATE, and the business category as BUSINESS", () => {
    expect(inferExpenseScope(tx({ categoryId: categoryIdFor("housing_rent") }), categories)).toBe("SEPARATE");
    expect(inferExpenseScope(tx({ categoryId: categoryIdFor("kids_school") }), categories)).toBe("SEPARATE");
    expect(inferExpenseScope(tx({ categoryId: categoryIdFor("business") }), categories)).toBe("BUSINESS");
  });

  it("is always TRANSFER for TRANSFER/EXCHANGE transaction types, even for a confirmed business merchant", () => {
    expect(inferExpenseScope(tx({ merchant: "Figma", transactionType: "TRANSFER" }), categories)).toBe("TRANSFER");
    expect(inferExpenseScope(tx({ transactionType: "EXCHANGE" }), categories)).toBe("TRANSFER");
  });

  it("falls back to HOUSEHOLD for an unknown or missing category", () => {
    expect(inferExpenseScope(tx({ categoryId: null }), categories)).toBe("HOUSEHOLD");
    expect(inferExpenseScope(tx({ categoryId: "cat_does_not_exist" }), categories)).toBe("HOUSEHOLD");
  });
});

describe("inferExpenseBehavior", () => {
  it("treats subscriptions, telecom, and housing utilities as FIXED", () => {
    expect(inferExpenseBehavior(tx({ categoryId: categoryIdFor("subscriptions") }), categories)).toBe("FIXED");
    expect(inferExpenseBehavior(tx({ categoryId: categoryIdFor("telecom") }), categories)).toBe("FIXED");
    expect(inferExpenseBehavior(tx({ categoryId: categoryIdFor("housing_electricity") }), categories)).toBe("FIXED");
  });

  it("keeps FIXED behavior for a subscription even when its scope is overridden to BUSINESS", () => {
    const subs = categoryIdFor("subscriptions");
    expect(inferExpenseBehavior(tx({ categoryId: subs }), categories)).toBe("FIXED");
    expect(inferExpenseScope(tx({ merchant: "Figma", categoryId: subs }), categories)).toBe("BUSINESS");
  });

  it("falls back to VARIABLE for an unclassified category", () => {
    expect(inferExpenseBehavior(tx({ categoryId: categoryIdFor("groceries") }), categories)).toBe("VARIABLE");
    expect(inferExpenseBehavior(tx({ categoryId: null }), categories)).toBe("VARIABLE");
  });
});

describe("resolveExpenseScope / resolveExpenseBehavior", () => {
  it("prefer an explicit tag over the inferred default", () => {
    const t = tx({ merchant: "Figma", categoryId: categoryIdFor("subscriptions"), scope: "HOUSEHOLD", expenseBehavior: "ONE_TIME" });
    expect(resolveExpenseScope(t, categories)).toBe("HOUSEHOLD");
    expect(resolveExpenseBehavior(t, categories)).toBe("ONE_TIME");
  });

  it("fall back to the inferred default when no explicit tag is set", () => {
    const t = tx({ merchant: "Figma", categoryId: categoryIdFor("subscriptions") });
    expect(resolveExpenseScope(t, categories)).toBe("BUSINESS");
    expect(resolveExpenseBehavior(t, categories)).toBe("FIXED");
  });
});

describe("homeSpendBucketFor", () => {
  it("buckets groceries, dining, and household/shopping/beauty correctly", () => {
    expect(homeSpendBucketFor(categoryIdFor("groceries_shopping"), categories)).toBe("GROCERIES");
    expect(homeSpendBucketFor(categoryIdFor("dining_cafe"), categories)).toBe("DINING");
    expect(homeSpendBucketFor(categoryIdFor("household"), categories)).toBe("SHOPPING");
    expect(homeSpendBucketFor(categoryIdFor("beauty"), categories)).toBe("SHOPPING");
  });

  it("falls back to OTHER for a category with no bucket mapping", () => {
    expect(homeSpendBucketFor(categoryIdFor("travel"), categories)).toBe("OTHER");
    expect(homeSpendBucketFor(null, categories)).toBe("OTHER");
  });
});
