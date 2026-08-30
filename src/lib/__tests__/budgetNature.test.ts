import { describe, expect, it } from "vitest";
import type { Transaction } from "@/types";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";
import { homeSpendBucketFor, inferBudgetNature, resolveBudgetNature } from "@/lib/budgetNature";

const categories = buildDefaultCategories();

function tx(partial: Partial<Transaction>): Pick<Transaction, "categoryId" | "transactionType" | "budgetNature"> {
  return {
    categoryId: null,
    transactionType: "EXPENSE",
    budgetNature: null,
    ...partial,
  };
}

describe("inferBudgetNature", () => {
  it("treats groceries as LIVING", () => {
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("groceries_food") }), categories)).toBe("LIVING");
  });

  it("treats rent as SEPARATE even though housing utilities are FIXED", () => {
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("housing_rent") }), categories)).toBe("SEPARATE");
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("housing_electricity") }), categories)).toBe("FIXED");
  });

  it("treats subscriptions and telecom as FIXED", () => {
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("subscriptions") }), categories)).toBe("FIXED");
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("telecom") }), categories)).toBe("FIXED");
  });

  it("treats the business category as BUSINESS", () => {
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("business") }), categories)).toBe("BUSINESS");
  });

  it("treats school tuition as SEPARATE but kids activities as FIXED", () => {
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("kids_school") }), categories)).toBe("SEPARATE");
    expect(inferBudgetNature(tx({ categoryId: categoryIdFor("kids_activities") }), categories)).toBe("FIXED");
  });

  it("is always TRANSFER for TRANSFER/EXCHANGE transaction types regardless of category", () => {
    expect(inferBudgetNature(tx({ transactionType: "TRANSFER", categoryId: categoryIdFor("groceries") }), categories)).toBe("TRANSFER");
    expect(inferBudgetNature(tx({ transactionType: "EXCHANGE" }), categories)).toBe("TRANSFER");
  });

  it("falls back to LIVING for an unknown or missing category", () => {
    expect(inferBudgetNature(tx({ categoryId: null }), categories)).toBe("LIVING");
    expect(inferBudgetNature(tx({ categoryId: "cat_does_not_exist" }), categories)).toBe("LIVING");
  });
});

describe("resolveBudgetNature", () => {
  it("prefers an explicit tag over the inferred default", () => {
    const t = tx({ categoryId: categoryIdFor("groceries"), budgetNature: "SEPARATE" });
    expect(resolveBudgetNature(t, categories)).toBe("SEPARATE");
  });

  it("falls back to the inferred default when no explicit tag is set", () => {
    const t = tx({ categoryId: categoryIdFor("groceries"), budgetNature: null });
    expect(resolveBudgetNature(t, categories)).toBe("LIVING");
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
