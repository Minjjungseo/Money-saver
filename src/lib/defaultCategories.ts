import type { Category } from "@/types";

interface CategorySeed {
  slug: string;
  name: string;
  isIncome?: boolean;
  children?: string[];
}

const CATEGORY_TREE: CategorySeed[] = [
  {
    slug: "housing",
    name: "Housing",
    children: ["Rent", "Utilities", "Water", "Electricity"],
  },
  { slug: "groceries", name: "Groceries" },
  { slug: "dining", name: "Dining" },
  {
    slug: "kids",
    name: "Kids",
    children: ["Education", "School", "Activities", "Baby/Kids items"],
  },
  {
    slug: "car",
    name: "Car",
    children: ["Fuel", "Rego", "Insurance", "Maintenance", "Parking"],
  },
  { slug: "shopping", name: "Shopping" },
  { slug: "beauty", name: "Beauty" },
  { slug: "health", name: "Health" },
  { slug: "travel", name: "Travel" },
  { slug: "entertainment", name: "Entertainment" },
  { slug: "subscriptions", name: "Subscriptions" },
  { slug: "business", name: "Business" },
  { slug: "income", name: "Income", isIncome: true },
  { slug: "other", name: "Other" },
];

/** Deterministic category id, stable across reseeds so demo data / rules can reference it. */
export function categoryIdFor(slug: string): string {
  return `cat_${slug}`;
}

export function buildDefaultCategories(): Category[] {
  const categories: Category[] = [];
  let sortOrder = 0;
  for (const seed of CATEGORY_TREE) {
    const parentId = categoryIdFor(seed.slug);
    categories.push({
      id: parentId,
      name: seed.name,
      parentId: null,
      isIncome: seed.isIncome ?? false,
      isSystem: true,
      sortOrder: sortOrder++,
    });
    for (const child of seed.children ?? []) {
      const childSlug = `${seed.slug}_${child.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
      categories.push({
        id: categoryIdFor(childSlug),
        name: child,
        parentId,
        isIncome: seed.isIncome ?? false,
        isSystem: true,
        sortOrder: sortOrder++,
      });
    }
  }
  return categories;
}
