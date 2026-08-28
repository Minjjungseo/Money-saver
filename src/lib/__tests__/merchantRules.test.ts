import { describe, expect, it } from "vitest";
import { matchCategoryByName, matchMerchantRule } from "@/lib/merchantRules";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";
import type { MerchantRule } from "@/types";

describe("matchMerchantRule", () => {
  const rules: MerchantRule[] = [
    {
      id: "r1",
      merchantPattern: "WOOLWORTHS",
      categoryId: categoryIdFor("groceries"),
      subcategory: null,
      confidence: 3,
      createdAt: "",
      updatedAt: "",
    },
    {
      id: "r2",
      merchantPattern: "DESK PAYMENT",
      categoryId: categoryIdFor("housing_rent"),
      subcategory: "Rent",
      confidence: 1,
      createdAt: "",
      updatedAt: "",
    },
  ];

  it("matches a merchant name containing the learned pattern", () => {
    const rule = matchMerchantRule("WOOLWORTHS 1234 SYDNEY", rules);
    expect(rule?.categoryId).toBe(categoryIdFor("groceries"));
  });

  it("learns from a user's correction (a rule the user just created)", () => {
    const rule = matchMerchantRule("DESK PAYMENT REF 998", rules);
    expect(rule?.subcategory).toBe("Rent");
  });

  it("returns null when nothing matches", () => {
    expect(matchMerchantRule("Some Random Cafe", rules)).toBeNull();
  });

  it("prefers the higher-confidence rule when multiple match", () => {
    const overlapping: MerchantRule[] = [
      { id: "a", merchantPattern: "CAFE", categoryId: "cat_dining", subcategory: null, confidence: 1, createdAt: "", updatedAt: "" },
      { id: "b", merchantPattern: "CAFE", categoryId: "cat_business", subcategory: null, confidence: 9, createdAt: "", updatedAt: "" },
    ];
    expect(matchMerchantRule("My Cafe", overlapping)?.categoryId).toBe("cat_business");
  });
});

describe("matchCategoryByName", () => {
  const categories = buildDefaultCategories();

  it("matches an exact category name case-insensitively", () => {
    expect(matchCategoryByName("식비", categories)).toBe(categoryIdFor("groceries"));
  });

  it("returns null for an unrecognized name", () => {
    expect(matchCategoryByName("Spaceships", categories)).toBeNull();
  });

  it("returns null for empty/undefined input", () => {
    expect(matchCategoryByName(null, categories)).toBeNull();
    expect(matchCategoryByName("", categories)).toBeNull();
  });
});
