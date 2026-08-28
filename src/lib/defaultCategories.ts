import type { Category } from "@/types";

interface ChildSeed {
  slug: string;
  name: string;
}

interface CategorySeed {
  slug: string;
  name: string;
  isIncome?: boolean;
  children?: ChildSeed[];
}

const CATEGORY_TREE: CategorySeed[] = [
  {
    slug: "housing",
    name: "주거",
    children: [
      { slug: "rent", name: "월세" },
      { slug: "water", name: "수도" },
      { slug: "electricity", name: "전기" },
      { slug: "gas", name: "가스" },
      { slug: "utilities_other", name: "기타 공과금" },
    ],
  },
  {
    slug: "groceries",
    name: "식비",
    children: [
      { slug: "shopping", name: "장보기" },
      { slug: "food", name: "식료품" },
    ],
  },
  {
    slug: "dining",
    name: "외식",
    children: [
      { slug: "restaurant", name: "식당" },
      { slug: "cafe", name: "카페" },
      { slug: "delivery", name: "배달" },
    ],
  },
  {
    slug: "kids",
    name: "아이",
    children: [
      { slug: "education", name: "교육" },
      { slug: "school", name: "학교" },
      { slug: "activities", name: "학원/활동" },
      { slug: "items", name: "육아용품" },
      { slug: "clothes", name: "아이 의류" },
    ],
  },
  {
    slug: "car",
    name: "차량",
    children: [
      { slug: "fuel", name: "주유" },
      { slug: "rego", name: "등록비" },
      { slug: "insurance", name: "보험" },
      { slug: "maintenance", name: "정비" },
      { slug: "parking", name: "주차" },
      { slug: "toll", name: "통행료" },
    ],
  },
  { slug: "shopping", name: "쇼핑" },
  { slug: "beauty", name: "뷰티" },
  {
    slug: "health",
    name: "건강",
    children: [
      { slug: "hospital", name: "병원" },
      { slug: "medicine", name: "약" },
      { slug: "wellness", name: "건강관리" },
    ],
  },
  { slug: "travel", name: "여행" },
  { slug: "entertainment", name: "문화/여가" },
  { slug: "subscriptions", name: "구독" },
  { slug: "telecom", name: "통신비" },
  { slug: "household", name: "생활용품" },
  { slug: "business", name: "사업비" },
  { slug: "income", name: "수입", isIncome: true },
  { slug: "other", name: "기타" },
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
      categories.push({
        id: categoryIdFor(`${seed.slug}_${child.slug}`),
        name: child.name,
        parentId,
        isIncome: seed.isIncome ?? false,
        isSystem: true,
        sortOrder: sortOrder++,
      });
    }
  }
  return categories;
}
