import type { RecurringExpense } from "@/types";
import { categoryIdFor } from "@/lib/defaultCategories";
import { toMinorUnits } from "@/lib/money";
import { generateId, nowIso } from "@/lib/id";

/**
 * The 8 real recurring/fixed-cost items confirmed against the household's
 * Notion Source of Truth. `name` is the stable identity used to upsert
 * against whatever a person's store already has (see upsertRecurringExpenseCatalog)
 * — never duplicated, matched by name or by one of `aliases` first so an
 * item created earlier under a slightly different label (e.g. via manual
 * entry or an older test run) is updated in place instead of duplicated.
 * All 8 are livingBudgetImpact: "INCLUDED" — together their monthly-equivalent
 * sum (≈A$3,557) is exactly what the HOME "고정지출" budget card shows.
 */
interface CatalogSeed {
  name: string;
  aliases: RegExp[];
  amountMinor: number | null;
  frequency: RecurringExpense["frequency"];
  customInterval?: RecurringExpense["customInterval"];
  monthlyEquivalentMinor: number | null;
  categoryId: string;
  essential: boolean;
  actualCycleNote?: string | null;
}

const CATALOG: CatalogSeed[] = [
  {
    name: "렌트",
    aliases: [/렌트/, /^rent$/i, /home\s*loan/i, /홈론/],
    amountMinor: toMinorUnits(1300, "AUD"),
    frequency: "FORTNIGHTLY",
    monthlyEquivalentMinor: toMinorUnits(2817, "AUD"),
    categoryId: categoryIdFor("housing_rent"),
    essential: true,
  },
  {
    name: "Carlile 수영",
    aliases: [/carlile/i],
    amountMinor: null,
    frequency: "TERM_BASED",
    monthlyEquivalentMinor: toMinorUnits(292, "AUD"),
    categoryId: categoryIdFor("kids_activities"),
    essential: false,
    actualCycleNote: "학기 단위 청구, 금액 미확정",
  },
  {
    name: "Alinta 전기",
    aliases: [/alinta/i],
    amountMinor: null,
    frequency: "CUSTOM",
    customInterval: { unit: "MONTH", count: 2 },
    monthlyEquivalentMinor: toMinorUnits(160, "AUD"),
    categoryId: categoryIdFor("housing_electricity"),
    essential: true,
    actualCycleNote: "2개월마다 청구, 금액 미확정",
  },
  {
    name: "Delta 체조",
    aliases: [/delta\s*gymnastics/i, /delta\s*체조/i],
    amountMinor: toMinorUnits(136, "AUD"),
    frequency: "MONTHLY",
    monthlyEquivalentMinor: null,
    categoryId: categoryIdFor("kids_activities"),
    essential: false,
  },
  {
    name: "PCYC",
    aliases: [/pcyc/i],
    amountMinor: toMinorUnits(34.28, "AUD"),
    frequency: "FORTNIGHTLY",
    monthlyEquivalentMinor: toMinorUnits(74, "AUD"),
    categoryId: categoryIdFor("kids_activities"),
    essential: false,
  },
  {
    name: "수도",
    aliases: [/수도/, /water/i],
    amountMinor: toMinorUnits(143.93, "AUD"),
    frequency: "QUARTERLY",
    monthlyEquivalentMinor: toMinorUnits(48, "AUD"),
    categoryId: categoryIdFor("housing_water"),
    essential: true,
  },
  {
    name: "Felix 휴대폰",
    aliases: [/felix/i],
    amountMinor: toMinorUnits(20, "AUD"),
    frequency: "MONTHLY",
    monthlyEquivalentMinor: null,
    categoryId: categoryIdFor("telecom"),
    essential: true,
  },
  {
    name: "Amazon Prime",
    aliases: [/amazon\s*prime/i],
    amountMinor: toMinorUnits(10, "AUD"),
    frequency: "MONTHLY",
    monthlyEquivalentMinor: null,
    categoryId: categoryIdFor("subscriptions"),
    essential: false,
  },
];

function findExisting(seed: CatalogSeed, existing: RecurringExpense[]): RecurringExpense | undefined {
  return existing.find(
    (r) => r.name === seed.name || seed.aliases.some((re) => re.test(r.name))
  );
}

/**
 * Upserts the 8-item real RecurringExpense catalog into whatever a person's
 * store already has: updates an existing item in place (matched by name or
 * alias) so nothing is duplicated, or creates it if genuinely missing.
 * nextDueDate is always left null here — none of the 8 items has a
 * confirmed next due date in the Source of Truth, and this migration never
 * guesses one (see RecurringExpenseStatus).
 */
export function upsertRecurringExpenseCatalog(existing: RecurringExpense[]): {
  recurringExpenses: RecurringExpense[];
  upsertedCount: number;
} {
  let recurringExpenses = [...existing];
  let upsertedCount = 0;

  for (const seed of CATALOG) {
    const match = findExisting(seed, recurringExpenses);

    if (match) {
      recurringExpenses = recurringExpenses.map((r): RecurringExpense =>
        r.id === match.id
          ? {
              ...r,
              name: seed.name,
              amountMinor: seed.amountMinor,
              currency: "AUD",
              frequency: seed.frequency,
              customInterval: seed.customInterval ?? null,
              monthlyEquivalentMinor: seed.monthlyEquivalentMinor,
              status: r.nextDueDate && seed.amountMinor !== null ? "ACTIVE" : "NEEDS_CONFIRMATION",
              essential: seed.essential,
              categoryId: seed.categoryId,
              livingBudgetImpact: "INCLUDED",
              actualCycleNote: seed.actualCycleNote ?? r.actualCycleNote ?? null,
              updatedAt: nowIso(),
            }
          : r
      );
      upsertedCount++;
    } else {
      const created: RecurringExpense = {
        id: generateId("rec"),
        name: seed.name,
        amountMinor: seed.amountMinor,
        currency: "AUD",
        frequency: seed.frequency,
        customInterval: seed.customInterval ?? null,
        monthlyEquivalentMinor: seed.monthlyEquivalentMinor,
        nextDueDate: null,
        status: "NEEDS_CONFIRMATION",
        essential: seed.essential,
        accountId: null,
        paymentNote: null,
        actualCycleNote: seed.actualCycleNote ?? null,
        livingBudgetImpact: "INCLUDED",
        startDate: nowIso().slice(0, 10),
        endDate: null,
        categoryId: seed.categoryId,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      recurringExpenses = [...recurringExpenses, created];
      upsertedCount++;
    }
  }

  return { recurringExpenses, upsertedCount };
}
