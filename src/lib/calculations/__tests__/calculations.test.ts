import { describe, expect, it } from "vitest";
import type {
  Account,
  Budget,
  ExchangeRate,
  PlannedExpense,
  PlannedIncome,
  RecurringExpense,
  Settings,
  Transaction,
} from "@/types";
import { toMinorUnits } from "@/lib/money";
import {
  calculateAvailableToSpend,
  calculateAvailableToSpendReadiness,
  calculateCategoryBreakdown,
  calculateMonthlyExpense,
  calculateMonthlyIncome,
  calculateNetCashFlow,
  calculateTotalBalances,
  calculateUpcomingEssentialExpenses,
  calculateConfirmedIncoming,
  calculateWeeklyBudgetUsage,
  calculateFixedCostSummary,
  calculateExpenseTotals,
  calculateLivingSpendByBucket,
  expandRecurringOccurrences,
  getHorizonRange,
  getLatestTransactionDate,
  daysSinceLatestTransaction,
} from "@/lib/calculations";
import { describeFrequency } from "@/lib/labels";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";
import { DEFAULT_SETTINGS } from "@/lib/repository/localStorageRepository";

const RATES: ExchangeRate[] = [{ pair: "AUD_KRW", rate: 900, updatedAt: "2026-01-01" }];
const AUG = new Date(2026, 7, 15); // 15 Aug 2026

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? "t1",
    date: "2026-08-10",
    merchant: "Test",
    amountMinor: toMinorUnits(100, "AUD"),
    currency: "AUD",
    transactionType: "EXPENSE",
    categoryId: null,
    subcategory: null,
    accountId: "acc1",
    memo: "",
    source: "MANUAL",
    importBatchId: null,
    aiConfidence: null,
    reviewed: true,
    originalFileRef: null,
    createdAt: "2026-08-10T00:00:00Z",
    updatedAt: "2026-08-10T00:00:00Z",
    ...partial,
  };
}

function account(partial: Partial<Account>): Account {
  return {
    id: "acc1",
    name: "Test Account",
    bank: "Test Bank",
    currency: "AUD",
    balanceMinor: toMinorUnits(1000, "AUD"),
    balanceAsOfDate: "2026-08-01",
    type: "CHECKING",
    includeInAvailable: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("monthly income/expense classification", () => {
  it("EXPENSE increases expense total", () => {
    const t = [tx({ transactionType: "EXPENSE", amountMinor: toMinorUnits(50, "AUD") })];
    expect(calculateMonthlyExpense(t, AUG, "AUD", RATES)).toBe(toMinorUnits(50, "AUD"));
  });

  it("INCOME increases income total", () => {
    const t = [tx({ transactionType: "INCOME", amountMinor: toMinorUnits(200, "AUD") })];
    expect(calculateMonthlyIncome(t, AUG, "AUD", RATES)).toBe(toMinorUnits(200, "AUD"));
  });

  it("TRANSFER affects neither income nor expense", () => {
    const t = [tx({ transactionType: "TRANSFER", amountMinor: toMinorUnits(2000, "AUD") })];
    expect(calculateMonthlyIncome(t, AUG, "AUD", RATES)).toBe(0);
    expect(calculateMonthlyExpense(t, AUG, "AUD", RATES)).toBe(0);
  });

  it("EXCHANGE is excluded from income/expense", () => {
    const t = [tx({ transactionType: "EXCHANGE", amountMinor: toMinorUnits(500, "AUD") })];
    expect(calculateMonthlyIncome(t, AUG, "AUD", RATES)).toBe(0);
    expect(calculateMonthlyExpense(t, AUG, "AUD", RATES)).toBe(0);
  });

  it("REFUND offsets expense rather than adding income", () => {
    const t = [
      tx({ id: "t1", transactionType: "EXPENSE", amountMinor: toMinorUnits(80, "AUD") }),
      tx({ id: "t2", transactionType: "REFUND", amountMinor: toMinorUnits(20, "AUD") }),
    ];
    expect(calculateMonthlyExpense(t, AUG, "AUD", RATES)).toBe(toMinorUnits(60, "AUD"));
    expect(calculateMonthlyIncome(t, AUG, "AUD", RATES)).toBe(0);
  });

  it("CASH_WITHDRAWAL counts as an expense-side outflow", () => {
    const t = [tx({ transactionType: "CASH_WITHDRAWAL", amountMinor: toMinorUnits(200, "AUD") })];
    expect(calculateMonthlyExpense(t, AUG, "AUD", RATES)).toBe(toMinorUnits(200, "AUD"));
  });

  it("handles a different currency by converting to base", () => {
    const t = [tx({ transactionType: "EXPENSE", currency: "KRW", amountMinor: toMinorUnits(90000, "KRW") })];
    // 90,000 KRW / 900 = 100 AUD
    expect(calculateMonthlyExpense(t, AUG, "AUD", RATES)).toBe(toMinorUnits(100, "AUD"));
  });

  it("net cash flow = income - expense", () => {
    const t = [
      tx({ id: "i1", transactionType: "INCOME", amountMinor: toMinorUnits(500, "AUD") }),
      tx({ id: "e1", transactionType: "EXPENSE", amountMinor: toMinorUnits(300, "AUD") }),
    ];
    expect(calculateNetCashFlow(t, AUG, "AUD", RATES)).toBe(toMinorUnits(200, "AUD"));
  });

  it("recalculates independently when the month changes", () => {
    const t = [
      tx({ id: "aug", date: "2026-08-05", transactionType: "EXPENSE", amountMinor: toMinorUnits(100, "AUD") }),
      tx({ id: "jul", date: "2026-07-05", transactionType: "EXPENSE", amountMinor: toMinorUnits(40, "AUD") }),
    ];
    expect(calculateMonthlyExpense(t, new Date(2026, 7, 20), "AUD", RATES)).toBe(toMinorUnits(100, "AUD"));
    expect(calculateMonthlyExpense(t, new Date(2026, 6, 20), "AUD", RATES)).toBe(toMinorUnits(40, "AUD"));
  });
});

describe("account balances", () => {
  it("excludes accounts with includeInAvailable=false", () => {
    const accounts = [
      account({ id: "a", balanceMinor: toMinorUnits(1000, "AUD"), includeInAvailable: true }),
      account({ id: "b", balanceMinor: toMinorUnits(5000, "AUD"), includeInAvailable: false }),
    ];
    expect(calculateTotalBalances(accounts, "AUD", RATES)).toBe(toMinorUnits(1000, "AUD"));
  });

  it("converts KRW balances into the AUD base currency", () => {
    const accounts = [account({ id: "a", currency: "KRW", balanceMinor: toMinorUnits(900000, "KRW") })];
    expect(calculateTotalBalances(accounts, "AUD", RATES)).toBe(toMinorUnits(1000, "AUD"));
  });
});

describe("available to spend", () => {
  const recurring: RecurringExpense = {
    id: "r1",
    name: "Rent",
    amountMinor: toMinorUnits(650, "AUD"),
    currency: "AUD",
    frequency: "WEEKLY",
    nextDueDate: "2026-08-17",
    essential: true,
    accountId: "acc1",
    startDate: "2026-01-01",
    endDate: null,
    createdAt: "",
    updatedAt: "",
    categoryId: null,
  };

  it("includes essential recurring expenses due within the horizon", () => {
    const total = calculateUpcomingEssentialExpenses([recurring], [], AUG, new Date(2026, 7, 31), "AUD", RATES);
    // 17, 24, 31 Aug = 3 occurrences
    expect(total).toBe(toMinorUnits(650 * 3, "AUD"));
  });

  it("excludes optional (non-essential) planned expenses from the essential total", () => {
    const optional: PlannedExpense = {
      id: "p1",
      date: "2026-08-20",
      name: "Sydney trip",
      expectedAmountMinor: toMinorUnits(800, "AUD"),
      currency: "AUD",
      essential: false,
      accountId: null,
      status: "PLANNED",
      categoryId: null,
      createdAt: "",
      updatedAt: "",
    };
    const total = calculateUpcomingEssentialExpenses([], [optional], AUG, new Date(2026, 7, 31), "AUD", RATES);
    expect(total).toBe(0);
  });

  it("only counts confirmed income, not estimated", () => {
    const incomes: PlannedIncome[] = [
      {
        id: "i1",
        name: "Salary",
        amountMinor: toMinorUnits(2600, "AUD"),
        expectedDate: "2026-08-25",
        currency: "AUD",
        confirmed: true,
        source: "Employer",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "i2",
        name: "Freelance",
        amountMinor: toMinorUnits(500, "AUD"),
        expectedDate: "2026-08-26",
        currency: "AUD",
        confirmed: false,
        source: "Client",
        createdAt: "",
        updatedAt: "",
      },
    ];
    const total = calculateConfirmedIncoming(incomes, AUG, new Date(2026, 7, 31), "AUD", RATES);
    expect(total).toBe(toMinorUnits(2600, "AUD"));
  });

  it("computes the full hero formula and subtracts the reserve", () => {
    const accounts = [account({ balanceMinor: toMinorUnits(5820, "AUD") })];
    const result = calculateAvailableToSpend({
      accounts,
      recurringExpenses: [recurring],
      plannedExpenses: [],
      plannedIncomes: [
        {
          id: "i1",
          name: "Salary",
          amountMinor: toMinorUnits(2600, "AUD"),
          expectedDate: "2026-08-25",
          currency: "AUD",
          confirmed: true,
          source: "Employer",
          createdAt: "",
          updatedAt: "",
        },
      ],
      reserveMinor: toMinorUnits(5000, "AUD"),
      reserveCurrency: "AUD",
      baseCurrency: "AUD",
      rates: RATES,
      referenceDate: AUG,
      horizon: "END_OF_MONTH",
    });
    // 5820 + 2600 - 1950 (3 x 650) - 5000 = 1470
    expect(result.currentBalance).toBe(toMinorUnits(5820, "AUD"));
    expect(result.confirmedIncoming).toBe(toMinorUnits(2600, "AUD"));
    expect(result.upcomingEssential).toBe(toMinorUnits(1950, "AUD"));
    expect(result.reserve).toBe(toMinorUnits(5000, "AUD"));
    expect(result.availableToSpend).toBe(toMinorUnits(1470, "AUD"));
  });

  it("includes a recurring expense due today even when 'now' has a later time-of-day", () => {
    // Regression: horizon start must be midnight, not the exact current instant,
    // otherwise a same-day due date (parsed at midnight) looks like it's already past.
    const rentDueToday: RecurringExpense = { ...recurring, nextDueDate: "2026-08-15" };
    const lateAfternoon = new Date(2026, 7, 15, 16, 45, 0);
    const { start, end } = getHorizonRange(lateAfternoon, "END_OF_MONTH");
    const total = calculateUpcomingEssentialExpenses([rentDueToday], [], start, end, "AUD", RATES);
    expect(total).toBeGreaterThan(0);
  });

  it("transfers never enter the available-to-spend formula (they're already in balances)", () => {
    const accounts = [account({ balanceMinor: toMinorUnits(1000, "AUD") })];
    const withoutTransfer = calculateAvailableToSpend({
      accounts,
      recurringExpenses: [],
      plannedExpenses: [],
      plannedIncomes: [],
      reserveMinor: 0,
      reserveCurrency: "AUD",
      baseCurrency: "AUD",
      rates: RATES,
      referenceDate: AUG,
      horizon: "END_OF_MONTH",
    });
    // A transfer transaction has no effect on this calculation by construction:
    // it never appears in accounts/recurring/planned inputs.
    expect(withoutTransfer.availableToSpend).toBe(toMinorUnits(1000, "AUD"));
  });
});

describe("category breakdown", () => {
  it("groups subcategory spend under its parent and nets refunds", () => {
    const categories = buildDefaultCategories();
    const fuelId = categoryIdFor("car_fuel");
    const t = [
      tx({ id: "e1", transactionType: "EXPENSE", categoryId: fuelId, amountMinor: toMinorUnits(72, "AUD") }),
      tx({ id: "e2", transactionType: "EXPENSE", categoryId: fuelId, amountMinor: toMinorUnits(60, "AUD") }),
      tx({ id: "r1", transactionType: "REFUND", categoryId: fuelId, amountMinor: toMinorUnits(12, "AUD") }),
    ];
    const breakdown = calculateCategoryBreakdown(t, categories, AUG, "AUD", RATES);
    const car = breakdown.find((b) => b.categoryId === categoryIdFor("car"));
    expect(car?.amountMinor).toBe(toMinorUnits(120, "AUD"));
  });
});

describe("CUSTOM_INTERVAL recurring frequency", () => {
  function customRecurring(partial: Partial<RecurringExpense>): RecurringExpense {
    return {
      id: "r1",
      name: "Electricity (Alinta)",
      amountMinor: toMinorUnits(160, "AUD"),
      currency: "AUD",
      frequency: "CUSTOM",
      customInterval: { unit: "MONTH", count: 2 },
      nextDueDate: "2026-08-10",
      essential: true,
      accountId: "acc1",
      startDate: "2026-08-10",
      endDate: null,
      categoryId: null,
      createdAt: "",
      updatedAt: "",
      ...partial,
    };
  }

  it("advances by N months for a MONTH-unit custom interval (e.g. bi-monthly)", () => {
    const occurrences = expandRecurringOccurrences(
      customRecurring({}),
      new Date(2026, 7, 1),
      new Date(2027, 1, 1)
    );
    expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-08-10",
      "2026-10-10",
      "2026-12-10",
    ]);
  });

  it("advances by N weeks for a WEEK-unit custom interval", () => {
    const occurrences = expandRecurringOccurrences(
      customRecurring({ customInterval: { unit: "WEEK", count: 3 }, nextDueDate: "2026-08-01" }),
      new Date(2026, 7, 1),
      new Date(2026, 8, 1)
    );
    expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-08-01",
      "2026-08-22",
    ]);
  });

  it("falls back to a sane default (1 month) if customInterval is missing", () => {
    const occurrences = expandRecurringOccurrences(
      customRecurring({ customInterval: null }),
      new Date(2026, 7, 1),
      new Date(2026, 9, 1)
    );
    expect(occurrences).toHaveLength(2);
  });

  it("describeFrequency resolves CUSTOM to its actual interval in Korean", () => {
    expect(describeFrequency({ frequency: "CUSTOM", customInterval: { unit: "MONTH", count: 2 } })).toBe(
      "2개월마다"
    );
    expect(describeFrequency({ frequency: "CUSTOM", customInterval: { unit: "WEEK", count: 3 } })).toBe(
      "3주마다"
    );
    expect(describeFrequency({ frequency: "MONTHLY", customInterval: null })).toBe("매월");
  });

  it("a bi-monthly CUSTOM recurring expense counts correctly toward upcoming essential spend", () => {
    const total = calculateUpcomingEssentialExpenses(
      [customRecurring({ essential: true })],
      [],
      new Date(2026, 7, 1),
      new Date(2026, 7, 31),
      "AUD",
      RATES
    );
    // Only the Aug 10 occurrence falls inside August.
    expect(total).toBe(toMinorUnits(160, "AUD"));
  });
});

describe("Available-to-Spend readiness gating", () => {
  const readySettings: Settings = { ...DEFAULT_SETTINGS, reserveConfirmed: true };
  const confirmedAccount = account({ includeInAvailable: true, balanceAsOfDate: "2026-08-19" });
  const essentialRecurring: RecurringExpense = {
    id: "r1",
    name: "Rent",
    amountMinor: toMinorUnits(650, "AUD"),
    currency: "AUD",
    frequency: "WEEKLY",
    nextDueDate: "2026-08-17",
    essential: true,
    accountId: "acc1",
    startDate: "2026-01-01",
    endDate: null,
    categoryId: null,
    createdAt: "",
    updatedAt: "",
  };
  const confirmedIncome: PlannedIncome = {
    id: "i1",
    name: "Salary",
    amountMinor: toMinorUnits(2600, "AUD"),
    expectedDate: "2026-08-25",
    currency: "AUD",
    confirmed: true,
    source: "Employer",
    createdAt: "",
    updatedAt: "",
  };

  it("is ready when all four conditions are satisfied", () => {
    const result = calculateAvailableToSpendReadiness({
      accounts: [confirmedAccount],
      recurringExpenses: [essentialRecurring],
      plannedExpenses: [],
      plannedIncomes: [confirmedIncome],
      settings: readySettings,
    });
    expect(result).toEqual({ ready: true, missing: [] });
  });

  it("flags an included account with no balanceAsOfDate as unconfirmed", () => {
    const unconfirmed = account({ includeInAvailable: true, balanceAsOfDate: null });
    const result = calculateAvailableToSpendReadiness({
      accounts: [unconfirmed],
      recurringExpenses: [essentialRecurring],
      plannedExpenses: [],
      plannedIncomes: [confirmedIncome],
      settings: readySettings,
    });
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("ACCOUNT_BALANCE_UNCONFIRMED");
  });

  it("ignores an unconfirmed balance on an account excluded from the available-to-spend calc", () => {
    const excludedUnconfirmed = account({ includeInAvailable: false, balanceAsOfDate: null });
    const result = calculateAvailableToSpendReadiness({
      accounts: [confirmedAccount, excludedUnconfirmed],
      recurringExpenses: [essentialRecurring],
      plannedExpenses: [],
      plannedIncomes: [confirmedIncome],
      settings: readySettings,
    });
    expect(result.missing).not.toContain("ACCOUNT_BALANCE_UNCONFIRMED");
  });

  it("flags missing essential recurring/planned expenses", () => {
    const result = calculateAvailableToSpendReadiness({
      accounts: [confirmedAccount],
      recurringExpenses: [],
      plannedExpenses: [],
      plannedIncomes: [confirmedIncome],
      settings: readySettings,
    });
    expect(result.missing).toContain("NO_ESSENTIAL_EXPENSE");
  });

  it("flags no planned income registered at all", () => {
    const result = calculateAvailableToSpendReadiness({
      accounts: [confirmedAccount],
      recurringExpenses: [essentialRecurring],
      plannedExpenses: [],
      plannedIncomes: [],
      settings: readySettings,
    });
    expect(result.missing).toContain("NO_PLANNED_INCOME");
  });

  it("flags an unconfirmed reserve", () => {
    const result = calculateAvailableToSpendReadiness({
      accounts: [confirmedAccount],
      recurringExpenses: [essentialRecurring],
      plannedExpenses: [],
      plannedIncomes: [confirmedIncome],
      settings: { ...DEFAULT_SETTINGS, reserveConfirmed: false },
    });
    expect(result.missing).toContain("RESERVE_NOT_SET");
  });
});

describe("weekly budget usage", () => {
  const weeklyBudget: Budget = {
    id: "b1",
    name: "장보기",
    amountMinor: toMinorUnits(170, "AUD"),
    currency: "AUD",
    period: "WEEKLY",
    categoryId: null,
    active: true,
    createdAt: "",
    updatedAt: "",
  };

  it("sums active weekly budgets and nets spend against them for the current week", () => {
    const transactions = [
      // AUG (2026-08-15) and the tx() default date (2026-08-10) both fall in the
      // same Mon-Sun week (Aug 10-16).
      tx({ id: "e1", date: "2026-08-10", transactionType: "EXPENSE", amountMinor: toMinorUnits(80, "AUD") }),
      tx({ id: "e2", date: "2026-08-12", transactionType: "EXPENSE", amountMinor: toMinorUnits(50, "AUD") }),
      tx({ id: "r1", date: "2026-08-13", transactionType: "REFUND", amountMinor: toMinorUnits(10, "AUD") }),
      // Outside the current week — must not count.
      tx({ id: "e3", date: "2026-08-01", transactionType: "EXPENSE", amountMinor: toMinorUnits(999, "AUD") }),
      // A transfer must never count as spend.
      tx({ id: "t1", date: "2026-08-11", transactionType: "TRANSFER", amountMinor: toMinorUnits(500, "AUD") }),
    ];
    const usage = calculateWeeklyBudgetUsage(transactions, [weeklyBudget], AUG, "AUD", RATES);
    expect(usage.budgetMinor).toBe(toMinorUnits(170, "AUD"));
    expect(usage.usedMinor).toBe(toMinorUnits(120, "AUD")); // 80 + 50 - 10
    expect(usage.remainingMinor).toBe(toMinorUnits(50, "AUD"));
  });

  it("ignores inactive and monthly budgets", () => {
    const inactive: Budget = { ...weeklyBudget, id: "b2", active: false };
    const monthly: Budget = { ...weeklyBudget, id: "b3", period: "MONTHLY" };
    const usage = calculateWeeklyBudgetUsage([], [inactive, monthly], AUG, "AUD", RATES);
    expect(usage.budgetMinor).toBe(0);
  });

  it("scopes a category-specific budget to only that category's spend", () => {
    const categories = buildDefaultCategories();
    const groceryId = categoryIdFor("groceries");
    const diningId = categoryIdFor("dining");
    const scoped: Budget = { ...weeklyBudget, categoryId: groceryId };
    const transactions = [
      tx({ id: "e1", date: "2026-08-10", transactionType: "EXPENSE", categoryId: groceryId, amountMinor: toMinorUnits(50, "AUD") }),
      tx({ id: "e2", date: "2026-08-11", transactionType: "EXPENSE", categoryId: diningId, amountMinor: toMinorUnits(999, "AUD") }),
    ];
    const usage = calculateWeeklyBudgetUsage(transactions, [scoped], AUG, "AUD", RATES);
    expect(usage.usedMinor).toBe(toMinorUnits(50, "AUD"));
    void categories;
  });
});

describe("data freshness", () => {
  it("returns the most recent transaction date", () => {
    const transactions = [
      tx({ id: "a", date: "2026-08-10" }),
      tx({ id: "b", date: "2026-08-19" }),
      tx({ id: "c", date: "2026-07-30" }),
    ];
    expect(getLatestTransactionDate(transactions)).toBe("2026-08-19");
  });

  it("returns null when there are no transactions", () => {
    expect(getLatestTransactionDate([])).toBeNull();
  });

  it("computes days behind the reference date", () => {
    const transactions = [tx({ date: "2026-08-19" })];
    expect(daysSinceLatestTransaction(transactions, new Date(2026, 7, 28))).toBe(9);
  });

  it("is zero when the latest transaction is today", () => {
    const transactions = [tx({ date: "2026-08-28" })];
    expect(daysSinceLatestTransaction(transactions, new Date(2026, 7, 28, 18, 30))).toBe(0);
  });
});

describe("fixed cost summary", () => {
  function recurring(partial: Partial<RecurringExpense>): RecurringExpense {
    return {
      id: partial.id ?? "r1",
      name: "Item",
      amountMinor: toMinorUnits(100, "AUD"),
      currency: "AUD",
      frequency: "MONTHLY",
      nextDueDate: "2026-09-01",
      essential: true,
      accountId: null,
      startDate: "2026-01-01",
      endDate: null,
      categoryId: null,
      createdAt: "",
      updatedAt: "",
      ...partial,
    };
  }

  const monthlyBudget: Budget = {
    id: "b1",
    name: "생활비",
    amountMinor: toMinorUnits(2_000_000, "KRW"),
    currency: "KRW",
    period: "MONTHLY",
    categoryId: null,
    active: true,
    createdAt: "",
    updatedAt: "",
  };

  it("sums INCLUDED items per currency and leaves SEPARATE items out of the living-budget math", () => {
    const items = [
      recurring({ id: "r1", amountMinor: toMinorUnits(789, "AUD"), currency: "AUD", livingBudgetImpact: "INCLUDED" }),
      recurring({ id: "r2", amountMinor: toMinorUnits(96_900, "KRW"), currency: "KRW", livingBudgetImpact: "INCLUDED" }),
      recurring({ id: "r3", amountMinor: toMinorUnits(2_817, "AUD"), currency: "AUD", livingBudgetImpact: "SEPARATE" }),
    ];
    const summary = calculateFixedCostSummary(items, [monthlyBudget], "KRW", RATES);

    expect(summary.includedByCurrency.AUD).toBe(toMinorUnits(789, "AUD"));
    expect(summary.includedByCurrency.KRW).toBe(toMinorUnits(96_900, "KRW"));
    expect(summary.separateByCurrency.AUD).toBe(toMinorUnits(2_817, "AUD"));
    expect(summary.separateByCurrency.KRW).toBeUndefined();

    const expectedTotal = toMinorUnits(789 * 900 + 96_900, "KRW");
    expect(summary.includedTotalBaseMinor).toBe(expectedTotal);

    expect(summary.monthlyBudgetMinor).toBe(toMinorUnits(2_000_000, "KRW"));
    expect(summary.variableRemainingMinor).toBe(toMinorUnits(2_000_000, "KRW") - expectedTotal);
  });

  it("ignores items with no living-budget classification", () => {
    const items = [recurring({ livingBudgetImpact: null })];
    const summary = calculateFixedCostSummary(items, [], "KRW", RATES);
    expect(summary.includedByCurrency).toEqual({});
    expect(summary.separateByCurrency).toEqual({});
    expect(summary.includedTotalBaseMinor).toBe(0);
  });

  it("returns a null budget/remaining when no active monthly budget exists", () => {
    const items = [recurring({ livingBudgetImpact: "INCLUDED" })];
    const summary = calculateFixedCostSummary(items, [{ ...monthlyBudget, active: false }], "KRW", RATES);
    expect(summary.monthlyBudgetMinor).toBeNull();
    expect(summary.variableRemainingMinor).toBeNull();
  });
});

describe("expense totals and living spend by bucket", () => {
  const categories = buildDefaultCategories();
  const AUG_2026 = new Date(2026, 7, 1);

  function livingTx(partial: Partial<Transaction>): Transaction {
    return tx({
      id: partial.id ?? "t1",
      date: "2026-08-10",
      transactionType: "EXPENSE",
      currency: "AUD",
      ...partial,
    });
  }

  it("splits net spend into household-fixed/household-variable/business/separate, using explicit tags over inferred defaults", () => {
    const transactions = [
      livingTx({ id: "t1", categoryId: categoryIdFor("groceries"), amountMinor: toMinorUnits(50, "AUD") }),
      livingTx({ id: "t2", categoryId: categoryIdFor("subscriptions"), amountMinor: toMinorUnits(20, "AUD") }),
      livingTx({ id: "t3", categoryId: categoryIdFor("business"), amountMinor: toMinorUnits(30, "AUD") }),
      livingTx({ id: "t4", categoryId: categoryIdFor("housing_rent"), amountMinor: toMinorUnits(650, "AUD") }),
      livingTx({ id: "t5", categoryId: categoryIdFor("groceries"), amountMinor: toMinorUnits(10, "AUD"), scope: "SEPARATE" }),
      // A subscription-category merchant confirmed as business stays FIXED behavior but moves out of household entirely.
      livingTx({ id: "t6", merchant: "FIGMA", categoryId: categoryIdFor("subscriptions"), amountMinor: toMinorUnits(15, "AUD") }),
    ];

    const totals = calculateExpenseTotals(transactions, categories, AUG_2026, "AUD", RATES);
    expect(totals.householdVariableMinor).toBe(toMinorUnits(50, "AUD"));
    expect(totals.householdFixedMinor).toBe(toMinorUnits(20, "AUD"));
    expect(totals.businessMinor).toBe(toMinorUnits(30 + 15, "AUD"));
    expect(totals.separateMinor).toBe(toMinorUnits(650 + 10, "AUD"));
  });

  it("excludes transactions outside the given month", () => {
    const transactions = [livingTx({ date: "2026-07-15", categoryId: categoryIdFor("groceries"), amountMinor: toMinorUnits(50, "AUD") })];
    const totals = calculateExpenseTotals(transactions, categories, AUG_2026, "AUD", RATES);
    expect(totals.householdVariableMinor).toBe(0);
  });

  it("ranks household/variable spend by the 7 simplified home buckets, excluding fixed/business/separate", () => {
    const transactions = [
      livingTx({ id: "t1", categoryId: categoryIdFor("groceries"), amountMinor: toMinorUnits(300, "AUD") }),
      livingTx({ id: "t2", categoryId: categoryIdFor("dining"), amountMinor: toMinorUnits(100, "AUD") }),
      livingTx({ id: "t3", categoryId: categoryIdFor("subscriptions"), amountMinor: toMinorUnits(999, "AUD") }), // household/FIXED, excluded
    ];
    const items = calculateLivingSpendByBucket(transactions, categories, AUG_2026, "AUD", RATES);
    expect(items.map((i) => i.bucket)).toEqual(["GROCERIES", "DINING"]);
    expect(items[0].amountMinor).toBe(toMinorUnits(300, "AUD"));
    expect(Math.round(items[0].percentage)).toBe(75);
  });

  it("computes each bucket's delta against the prior month", () => {
    const transactions = [
      livingTx({ id: "t1", date: "2026-08-10", categoryId: categoryIdFor("groceries"), amountMinor: toMinorUnits(300, "AUD") }),
      livingTx({ id: "t2", date: "2026-07-10", categoryId: categoryIdFor("groceries"), amountMinor: toMinorUnits(200, "AUD") }),
    ];
    const items = calculateLivingSpendByBucket(transactions, categories, AUG_2026, "AUD", RATES);
    expect(items[0].prevAmountMinor).toBe(toMinorUnits(200, "AUD"));
    expect(items[0].deltaMinor).toBe(toMinorUnits(100, "AUD"));
  });
});
