import { describe, expect, it } from "vitest";
import type {
  Account,
  ExchangeRate,
  PlannedExpense,
  PlannedIncome,
  RecurringExpense,
  Transaction,
} from "@/types";
import { toMinorUnits } from "@/lib/money";
import {
  calculateAvailableToSpend,
  calculateCategoryBreakdown,
  calculateMonthlyExpense,
  calculateMonthlyIncome,
  calculateNetCashFlow,
  calculateTotalBalances,
  calculateUpcomingEssentialExpenses,
  calculateConfirmedIncoming,
  getHorizonRange,
} from "@/lib/calculations";
import { buildDefaultCategories, categoryIdFor } from "@/lib/defaultCategories";

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
