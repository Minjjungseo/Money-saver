import type {
  Account,
  AppData,
  Budget,
  MerchantRule,
  PlannedExpense,
  PlannedIncome,
  RecurringExpense,
  Transaction,
} from "@/types";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";
import { toMinorUnits } from "@/lib/money";
import { generateId } from "@/lib/id";
import { DEFAULT_SETTINGS } from "@/lib/repository/localStorageRepository";
import { addDays, addMonths, format, startOfMonth, endOfMonth, setDate } from "date-fns";

/** Small deterministic PRNG so demo data looks the same on every fresh seed. */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260827);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function jitter(base: number, pct: number): number {
  return base * (1 + (rand() * 2 - 1) * pct);
}

const fmt = (d: Date) => format(d, "yyyy-MM-dd");

export function buildDemoData(referenceDate: Date = new Date()): AppData {
  const categories = buildDefaultCategories();
  const nowIso = new Date().toISOString();

  const accEveryday: Account = {
    id: "acc_demo_everyday",
    name: "Commonwealth Everyday",
    bank: "Commonwealth Bank",
    currency: "AUD",
    balanceMinor: toMinorUnits(5820, "AUD"),
    balanceAsOfDate: fmt(referenceDate),
    type: "CHECKING",
    includeInAvailable: true,
    isDemo: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const accKorean: Account = {
    id: "acc_demo_korean",
    name: "Korean Account",
    bank: "KB Kookmin",
    currency: "KRW",
    balanceMinor: toMinorUnits(3200000, "KRW"),
    balanceAsOfDate: fmt(referenceDate),
    type: "SAVINGS",
    includeInAvailable: true,
    isDemo: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const accCash: Account = {
    id: "acc_demo_cash",
    name: "Cash",
    bank: "Cash",
    currency: "AUD",
    balanceMinor: toMinorUnits(120, "AUD"),
    balanceAsOfDate: fmt(referenceDate),
    type: "CASH",
    includeInAvailable: true,
    isDemo: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  const accounts: Account[] = [accEveryday, accKorean, accCash];

  const cat = categoryIdFor;
  const transactions: Transaction[] = [];

  const groceryMerchants = ["Woolworths", "Coles", "Aldi"];
  const diningMerchants = ["Merivale Cafe", "Guzman y Gomez", "Local Thai", "Bakehouse"];
  const shoppingMerchants = ["Kmart", "Officeworks", "Amazon AU"];

  function addTx(partial: Omit<Transaction, "id" | "createdAt" | "updatedAt" | "source" | "importBatchId" | "aiConfidence" | "reviewed" | "originalFileRef" | "isDemo">) {
    transactions.push({
      ...partial,
      id: generateId("txn"),
      source: "MANUAL",
      importBatchId: null,
      aiConfidence: null,
      reviewed: true,
      originalFileRef: null,
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }

  const monthCount = 5; // Apr..Aug when reference month is Aug
  for (let m = monthCount - 1; m >= 0; m--) {
    const monthDate = addMonths(startOfMonth(referenceDate), -m);
    const monthEnd = endOfMonth(monthDate);
    const isCurrentMonth = m === 0;
    const cutoff = isCurrentMonth ? referenceDate : monthEnd;

    // Fortnightly salary income (1st + 15th)
    for (const day of [1, 15]) {
      const d = setDate(monthDate, day);
      if (d <= cutoff) {
        addTx({
          date: fmt(d),
          merchant: "Acme Corp Payroll",
          amountMinor: toMinorUnits(jitter(2600, 0.02), "AUD"),
          currency: "AUD",
          transactionType: "INCOME",
          categoryId: cat("income"),
          subcategory: null,
          accountId: accEveryday.id,
          memo: "Salary",
          transferAccountId: null,
        });
      }
    }

    // Weekly rent, Mondays
    let rentDay = setDate(monthDate, 1);
    while (rentDay.getDay() !== 1) rentDay = addDays(rentDay, 1);
    while (rentDay <= monthEnd) {
      if (rentDay <= cutoff) {
        addTx({
          date: fmt(rentDay),
          merchant: "Ray White Property Mgmt",
          amountMinor: toMinorUnits(650, "AUD"),
          currency: "AUD",
          transactionType: "EXPENSE",
          categoryId: cat("housing"),
          subcategory: "월세",
          accountId: accEveryday.id,
          memo: "Weekly rent",
          transferAccountId: null,
        });
      }
      rentDay = addDays(rentDay, 7);
    }

    // Utilities, once a month
    const utilDay = setDate(monthDate, 18);
    if (utilDay <= cutoff) {
      addTx({
        date: fmt(utilDay),
        merchant: "AGL Energy",
        amountMinor: toMinorUnits(jitter(145, 0.15), "AUD"),
        currency: "AUD",
        transactionType: "EXPENSE",
        categoryId: cat("housing"),
        subcategory: "전기",
        accountId: accEveryday.id,
        memo: "",
        transferAccountId: null,
      });
    }

    // Groceries, ~8 times a month
    for (let i = 0; i < 8; i++) {
      const d = setDate(monthDate, Math.min(28, 2 + i * 3));
      if (d <= cutoff) {
        addTx({
          date: fmt(d),
          merchant: pick(groceryMerchants),
          amountMinor: toMinorUnits(jitter(85, 0.3), "AUD"),
          currency: "AUD",
          transactionType: "EXPENSE",
          categoryId: cat("groceries"),
          subcategory: null,
          accountId: accEveryday.id,
          memo: "",
          transferAccountId: null,
        });
      }
    }

    // Dining, ~5 times a month
    for (let i = 0; i < 5; i++) {
      const d = setDate(monthDate, Math.min(27, 4 + i * 5));
      if (d <= cutoff) {
        addTx({
          date: fmt(d),
          merchant: pick(diningMerchants),
          amountMinor: toMinorUnits(jitter(38, 0.4), "AUD"),
          currency: "AUD",
          transactionType: "EXPENSE",
          categoryId: cat("dining"),
          subcategory: null,
          accountId: accEveryday.id,
          memo: "",
          transferAccountId: null,
        });
      }
    }

    // Car: fuel fortnightly + occasional parking
    for (const day of [6, 20]) {
      const d = setDate(monthDate, day);
      if (d <= cutoff) {
        addTx({
          date: fmt(d),
          merchant: "Ampol",
          amountMinor: toMinorUnits(jitter(72, 0.2), "AUD"),
          currency: "AUD",
          transactionType: "EXPENSE",
          categoryId: cat("car"),
          subcategory: "주유",
          accountId: accEveryday.id,
          memo: "",
          transferAccountId: null,
        });
      }
    }

    // Kids: school/activities
    const kidsDay = setDate(monthDate, 10);
    if (kidsDay <= cutoff) {
      addTx({
        date: fmt(kidsDay),
        merchant: "Little Learners Kindy",
        amountMinor: toMinorUnits(jitter(240, 0.1), "AUD"),
        currency: "AUD",
        transactionType: "EXPENSE",
        categoryId: cat("kids"),
        subcategory: "학원/활동",
        accountId: accEveryday.id,
        memo: "",
        transferAccountId: null,
      });
    }

    // Shopping, occasional
    if (rand() > 0.4) {
      const d = setDate(monthDate, 22);
      if (d <= cutoff) {
        addTx({
          date: fmt(d),
          merchant: pick(shoppingMerchants),
          amountMinor: toMinorUnits(jitter(65, 0.5), "AUD"),
          currency: "AUD",
          transactionType: "EXPENSE",
          categoryId: cat("shopping"),
          subcategory: null,
          accountId: accEveryday.id,
          memo: "",
          transferAccountId: null,
        });
      }
    }

    // Subscriptions
    const subDay = setDate(monthDate, 3);
    if (subDay <= cutoff) {
      addTx({
        date: fmt(subDay),
        merchant: "Netflix",
        amountMinor: toMinorUnits(16.99, "AUD"),
        currency: "AUD",
        transactionType: "EXPENSE",
        categoryId: cat("subscriptions"),
        subcategory: null,
        accountId: accEveryday.id,
        memo: "",
        transferAccountId: null,
      });
    }
  }

  // A couple of special demo transactions this month, matching the spec's examples.
  const today = referenceDate;
  addTx({
    date: fmt(today),
    merchant: "Woolworths",
    amountMinor: toMinorUnits(84.53, "AUD"),
    currency: "AUD",
    transactionType: "EXPENSE",
    categoryId: cat("groceries"),
    subcategory: null,
    accountId: accEveryday.id,
    memo: "",
    transferAccountId: null,
  });
  addTx({
    date: fmt(today),
    merchant: "Ampol",
    amountMinor: toMinorUnits(72.1, "AUD"),
    currency: "AUD",
    transactionType: "EXPENSE",
    categoryId: cat("car"),
    subcategory: "주유",
    accountId: accEveryday.id,
    memo: "",
    transferAccountId: null,
  });
  addTx({
    date: fmt(addDays(today, -2)),
    merchant: "Transfer from Korea",
    amountMinor: toMinorUnits(2000, "AUD"),
    currency: "AUD",
    transactionType: "TRANSFER",
    categoryId: null,
    subcategory: null,
    accountId: accEveryday.id,
    memo: "Personal transfer, excluded from income",
    transferAccountId: accKorean.id,
  });
  addTx({
    date: fmt(addDays(today, -5)),
    merchant: "ATM Withdrawal",
    amountMinor: toMinorUnits(200, "AUD"),
    currency: "AUD",
    transactionType: "CASH_WITHDRAWAL",
    categoryId: cat("other"),
    subcategory: null,
    accountId: accEveryday.id,
    memo: "",
    transferAccountId: null,
  });
  addTx({
    date: fmt(addDays(today, -6)),
    merchant: "Kmart Refund",
    amountMinor: toMinorUnits(22, "AUD"),
    currency: "AUD",
    transactionType: "REFUND",
    categoryId: cat("shopping"),
    subcategory: null,
    accountId: accEveryday.id,
    memo: "Returned item",
    transferAccountId: null,
  });

  transactions.sort((a, b) => (a.date < b.date ? 1 : -1));

  const recurringExpenses: RecurringExpense[] = [
    {
      id: generateId("rec"),
      name: "Rent",
      amountMinor: toMinorUnits(650, "AUD"),
      currency: "AUD",
      frequency: "WEEKLY",
      nextDueDate: fmt(nextWeekday(today, 1)),
      essential: true,
      accountId: accEveryday.id,
      startDate: fmt(addMonths(today, -12)),
      endDate: null,
      categoryId: cat("housing"),
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId("rec"),
      name: "Car Registration (Rego)",
      amountMinor: toMinorUnits(864.5, "AUD"),
      currency: "AUD",
      frequency: "YEARLY",
      nextDueDate: fmt(new Date(today.getFullYear(), 8, 30)),
      essential: true,
      accountId: accEveryday.id,
      startDate: fmt(addMonths(today, -12)),
      endDate: null,
      categoryId: cat("car"),
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId("rec"),
      name: "Netflix",
      amountMinor: toMinorUnits(16.99, "AUD"),
      currency: "AUD",
      frequency: "MONTHLY",
      nextDueDate: fmt(setDate(addMonths(today, 1), 3)),
      essential: false,
      accountId: accEveryday.id,
      startDate: fmt(addMonths(today, -12)),
      endDate: null,
      categoryId: cat("subscriptions"),
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId("rec"),
      name: "Electricity (AGL)",
      amountMinor: toMinorUnits(145, "AUD"),
      currency: "AUD",
      frequency: "MONTHLY",
      nextDueDate: fmt(setDate(addMonths(today, 1), 18)),
      essential: true,
      accountId: accEveryday.id,
      startDate: fmt(addMonths(today, -12)),
      endDate: null,
      categoryId: cat("housing"),
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const plannedExpenses: PlannedExpense[] = [
    {
      id: generateId("plexp"),
      date: fmt(addDays(today, 30)),
      name: "Sydney trip",
      expectedAmountMinor: toMinorUnits(800, "AUD"),
      currency: "AUD",
      essential: false,
      accountId: accEveryday.id,
      status: "PLANNED",
      categoryId: cat("travel"),
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const plannedIncomes: PlannedIncome[] = [
    {
      id: generateId("plinc"),
      name: "Acme Corp Payroll",
      amountMinor: toMinorUnits(2600, "AUD"),
      expectedDate: fmt(setDate(addMonths(today, 1), 1)),
      currency: "AUD",
      confirmed: true,
      source: "Employer",
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: generateId("plinc"),
      name: "Freelance project",
      amountMinor: toMinorUnits(500, "AUD"),
      expectedDate: fmt(addDays(today, 20)),
      currency: "AUD",
      confirmed: false,
      source: "Freelance client",
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const budgets: Budget[] = [
    {
      id: generateId("budget"),
      name: "주간 생활비",
      amountMinor: toMinorUnits(300, "AUD"),
      currency: "AUD",
      period: "WEEKLY",
      categoryId: null,
      active: true,
      isDemo: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  return {
    accounts,
    transactions,
    categories,
    recurringExpenses,
    plannedExpenses,
    plannedIncomes,
    budgets,
    importBatches: [],
    merchantRules: [
      {
        id: generateId("rule"),
        merchantPattern: "WOOLWORTHS",
        categoryId: cat("groceries"),
        subcategory: null,
        confidence: 5,
        isDemo: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: generateId("rule"),
        merchantPattern: "COLES",
        categoryId: cat("groceries"),
        subcategory: null,
        confidence: 5,
        isDemo: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: generateId("rule"),
        merchantPattern: "AMPOL",
        categoryId: cat("car"),
        subcategory: "주유",
        confidence: 5,
        isDemo: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ] satisfies MerchantRule[],
    exchangeRates: [{ pair: "AUD_KRW", rate: 900, updatedAt: nowIso }],
    settings: {
      ...DEFAULT_SETTINGS,
      reserveMinor: toMinorUnits(5000, "AUD"),
      reserveConfirmed: true,
      demoDataActive: true,
    },
  };
}

/**
 * Whether any demo/example data is actually present right now, checked by
 * the explicit `isDemo` flag on each record — never inferred from values
 * looking similar to real data. Used to drive the "예시 데이터" badge and the
 * "예시 데이터 지우기" button so they reflect real state even if demo items
 * were removed one at a time rather than via clearDemoData().
 */
export function hasDemoData(data: AppData): boolean {
  return (
    data.accounts.some((a) => a.isDemo) ||
    data.transactions.some((t) => t.isDemo) ||
    data.recurringExpenses.some((r) => r.isDemo) ||
    data.plannedExpenses.some((p) => p.isDemo) ||
    data.plannedIncomes.some((p) => p.isDemo) ||
    data.budgets.some((b) => b.isDemo) ||
    data.merchantRules.some((m) => m.isDemo)
  );
}

function nextWeekday(from: Date, weekday: number): Date {
  let d = from;
  while (d.getDay() !== weekday) d = addDays(d, 1);
  return d;
}
