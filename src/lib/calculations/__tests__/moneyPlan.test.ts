import { describe, expect, it } from "vitest";
import type { Account, ExchangeRate, RecurringExpense, Transaction } from "@/types";
import { toMinorUnits } from "@/lib/money";
import { categoryIdFor } from "@/lib/defaultCategories";
import { DEFAULT_MONEY_PLAN_BUCKET_CONFIG } from "@/lib/repository";
import { calculateMoneyPlan, calculateHyundaiCardAutoKrwMinor, calculateAuFixedCostMinor } from "../moneyPlan";

const SEP = new Date(2026, 8, 15); // 15 Sep 2026
const RATE = 978; // 1 AUD = 978 KRW, close to the spec's implied rate
const RATES: ExchangeRate[] = [{ pair: "AUD_KRW", rate: RATE, updatedAt: "2026-01-01" }];

function account(partial: Partial<Account>): Account {
  return {
    id: "acc",
    name: "",
    bank: "",
    currency: "AUD",
    balanceMinor: 0,
    balanceAsOfDate: "2026-09-01",
    type: "CHECKING",
    includeInAvailable: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t",
    date: "2026-09-05",
    merchant: "m",
    amountMinor: 0,
    currency: "KRW",
    transactionType: "EXPENSE",
    categoryId: null,
    subcategory: null,
    accountId: null,
    memo: "",
    source: "MANUAL",
    importBatchId: null,
    aiConfidence: null,
    reviewed: false,
    originalFileRef: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function recurring(partial: Partial<RecurringExpense>): RecurringExpense {
  return {
    id: "r",
    name: "",
    amountMinor: null,
    currency: "AUD",
    frequency: "MONTHLY",
    monthlyEquivalentMinor: null,
    nextDueDate: null,
    status: "NEEDS_CONFIRMATION",
    essential: true,
    accountId: null,
    livingBudgetImpact: "INCLUDED",
    startDate: "2026-01-01",
    endDate: null,
    categoryId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

const shinhan = account({ id: "acc_shinhan", name: "신한은행", bank: "신한은행", currency: "KRW", balanceMinor: 150000 });
const hyundai = account({ id: "acc_hyundai", name: "현대카드", bank: "현대카드", currency: "KRW", type: "CREDIT_CARD", balanceMinor: 0 });
const commbank = account({ id: "acc_commbank", name: "CommBank", bank: "CommBank", currency: "AUD", balanceMinor: toMinorUnits(300, "AUD") });
const hana = account({ id: "acc_hana", name: "하나트래블로그", bank: "하나은행", currency: "AUD", balanceMinor: toMinorUnits(1013.37, "AUD") });

const auFixedItem = recurring({
  id: "rec_fixed",
  name: "기타 AU 고정비",
  monthlyEquivalentMinor: toMinorUnits(687, "AUD"),
  categoryId: categoryIdFor("housing_electricity"),
});
const rentItem = recurring({
  id: "rec_rent",
  name: "렌트",
  monthlyEquivalentMinor: toMinorUnits(2817, "AUD"),
  categoryId: categoryIdFor("housing_rent"),
});

const hyundaiCardTx = tx({
  id: "t_hyundai",
  date: "2026-09-10",
  accountId: hyundai.id,
  amountMinor: 150000,
  currency: "KRW",
  transactionType: "EXPENSE",
});

describe("calculateHyundaiCardAutoKrwMinor", () => {
  it("sums this month's expense on the matched 현대카드 account", () => {
    const result = calculateHyundaiCardAutoKrwMinor([hyundaiCardTx], [hyundai], SEP, RATES);
    expect(result).toBe(150000);
  });

  it("nets a REFUND against the expense total", () => {
    const refund = tx({ id: "t_refund", date: "2026-09-12", accountId: hyundai.id, amountMinor: 20000, currency: "KRW", transactionType: "REFUND" });
    const result = calculateHyundaiCardAutoKrwMinor([hyundaiCardTx, refund], [hyundai], SEP, RATES);
    expect(result).toBe(130000);
  });

  it("ignores transactions outside the target month", () => {
    const augTx = tx({ id: "t_aug", date: "2026-08-20", accountId: hyundai.id, amountMinor: 999999, currency: "KRW", transactionType: "EXPENSE" });
    const result = calculateHyundaiCardAutoKrwMinor([augTx], [hyundai], SEP, RATES);
    expect(result).toBe(0);
  });

  it("returns 0 when no 현대카드 account exists", () => {
    const result = calculateHyundaiCardAutoKrwMinor([hyundaiCardTx], [shinhan, commbank, hana], SEP, RATES);
    expect(result).toBe(0);
  });
});

describe("calculateAuFixedCostMinor", () => {
  it("excludes rent when includeRent is false", () => {
    const result = calculateAuFixedCostMinor([auFixedItem, rentItem], false, "AUD", RATES);
    expect(result).toBe(toMinorUnits(687, "AUD"));
  });

  it("includes rent when includeRent is true", () => {
    const result = calculateAuFixedCostMinor([auFixedItem, rentItem], true, "AUD", RATES);
    expect(result).toBe(toMinorUnits(687 + 2817, "AUD"));
  });
});

describe("calculateMoneyPlan", () => {
  const accounts = [shinhan, hyundai, commbank, hana];
  const recurringExpenses = [auFixedItem, rentItem];

  it("reproduces the worked September example end to end (rent excluded)", () => {
    const result = calculateMoneyPlan({
      month: SEP,
      monthKey: "2026-09",
      totalBudgetKrwMinor: 2_000_000,
      hyundaiCardOverrideKrwMinor: null,
      includeRent: false,
      transactions: [hyundaiCardTx],
      accounts,
      recurringExpenses,
      bucketConfig: DEFAULT_MONEY_PLAN_BUCKET_CONFIG,
      rates: RATES,
    });

    // 카드 결제 예정액: auto-calculated from the 현대카드 transaction
    expect(result.hyundaiCardIsAuto).toBe(true);
    expect(result.hyundaiCardKrwMinor).toBe(150000);

    // 남은 예산 = 2,000,000 - 150,000
    expect(result.remainingBudgetKrwMinor).toBe(1_850_000);

    // 현지 고정비 (렌트 제외) = A$687
    expect(result.auFixedAudMinor).toBe(toMinorUnits(687, "AUD"));

    // 신한은행: 필요 150,000 / 보유 150,000 → 충분
    expect(result.koreaCard.requiredMinor).toBe(150000);
    expect(result.koreaCard.currentBalanceMinor).toBe(150000);
    expect(result.koreaCard.status).toBe("SUFFICIENT");
    expect(result.koreaCard.shortfallMinor).toBe(0);
    expect(result.koreaCard.accountId).toBe(shinhan.id);

    // CommBank: 필요 A$687 / 보유 A$300 → A$387 부족 (matches the spec's §9 example exactly)
    expect(result.auFixed.requiredMinor).toBe(toMinorUnits(687, "AUD"));
    expect(result.auFixed.currentBalanceMinor).toBe(toMinorUnits(300, "AUD"));
    expect(result.auFixed.shortfallMinor).toBe(toMinorUnits(387, "AUD"));
    expect(result.auFixed.status).toBe("SHORT");
    expect(result.auFixed.accountId).toBe(commbank.id);

    // 생활비 목표 ≈ A$1,204.62 (AUD환산 1,850,000/978 - 687), 하나 보유 A$1,013.37
    expect(result.living.requiredMinor).toBe(120462);
    expect(result.living.currentBalanceMinor).toBe(toMinorUnits(1013.37, "AUD"));
    expect(result.living.shortfallMinor).toBe(120462 - toMinorUnits(1013.37, "AUD"));
    expect(result.living.status).toBe("SHORT");
    expect(result.living.accountId).toBe(hana.id);

    // 새로 환전할 돈 = CommBank 부족분 + 하나 부족분 (never the raw bucket totals — see §6/§10: never re-ask for money already sitting in an account)
    expect(result.newExchangeNeededAudMinor).toBe(result.auFixed.shortfallMinor + result.living.shortfallMinor);
    expect(result.budgetExceeded).toBe(false);
  });

  it("respects a manual 현대카드 override instead of the auto-calculated figure", () => {
    const result = calculateMoneyPlan({
      month: SEP,
      monthKey: "2026-09",
      totalBudgetKrwMinor: 2_000_000,
      hyundaiCardOverrideKrwMinor: 300000,
      includeRent: false,
      transactions: [hyundaiCardTx], // would auto-calc to 150,000 if not overridden
      accounts,
      recurringExpenses,
      bucketConfig: DEFAULT_MONEY_PLAN_BUCKET_CONFIG,
      rates: RATES,
    });
    expect(result.hyundaiCardIsAuto).toBe(false);
    expect(result.hyundaiCardKrwMinor).toBe(300000);
    expect(result.remainingBudgetKrwMinor).toBe(1_700_000);
  });

  it("flags budgetExceeded when the KRW budget can't even cover AU fixed costs", () => {
    const result = calculateMoneyPlan({
      month: SEP,
      monthKey: "2026-09",
      totalBudgetKrwMinor: 100000,
      hyundaiCardOverrideKrwMinor: 0,
      includeRent: false,
      transactions: [],
      accounts,
      recurringExpenses,
      bucketConfig: DEFAULT_MONEY_PLAN_BUCKET_CONFIG,
      rates: RATES,
    });
    expect(result.budgetExceeded).toBe(true);
    expect(result.living.requiredMinor).toBe(0); // clamped, never negative
  });

  it("marks a bucket NEEDS_ACCOUNT when no account can be matched or configured", () => {
    const result = calculateMoneyPlan({
      month: SEP,
      monthKey: "2026-09",
      totalBudgetKrwMinor: 2_000_000,
      hyundaiCardOverrideKrwMinor: 0,
      includeRent: false,
      transactions: [],
      accounts: [], // nothing to match
      recurringExpenses,
      bucketConfig: DEFAULT_MONEY_PLAN_BUCKET_CONFIG,
      rates: RATES,
    });
    expect(result.koreaCard.status).toBe("NEEDS_ACCOUNT");
    expect(result.auFixed.status).toBe("NEEDS_ACCOUNT");
    expect(result.living.status).toBe("NEEDS_ACCOUNT");
  });

  it("an explicit bucketConfig id wins over name-based auto-matching", () => {
    const otherAccount = account({ id: "acc_other", name: "여윳돈 통장", bank: "기타은행", currency: "AUD", balanceMinor: 0 });
    const result = calculateMoneyPlan({
      month: SEP,
      monthKey: "2026-09",
      totalBudgetKrwMinor: 2_000_000,
      hyundaiCardOverrideKrwMinor: 0,
      includeRent: false,
      transactions: [],
      accounts: [...accounts, otherAccount],
      recurringExpenses,
      bucketConfig: { ...DEFAULT_MONEY_PLAN_BUCKET_CONFIG, livingAccountId: otherAccount.id },
      rates: RATES,
    });
    expect(result.living.accountId).toBe(otherAccount.id);
  });

  it("including rent lowers the living target by rent's monthly-equivalent", () => {
    const excluded = calculateMoneyPlan({
      month: SEP, monthKey: "2026-09", totalBudgetKrwMinor: 5_000_000, hyundaiCardOverrideKrwMinor: 0,
      includeRent: false, transactions: [], accounts, recurringExpenses, bucketConfig: DEFAULT_MONEY_PLAN_BUCKET_CONFIG, rates: RATES,
    });
    const included = calculateMoneyPlan({
      month: SEP, monthKey: "2026-09", totalBudgetKrwMinor: 5_000_000, hyundaiCardOverrideKrwMinor: 0,
      includeRent: true, transactions: [], accounts, recurringExpenses, bucketConfig: DEFAULT_MONEY_PLAN_BUCKET_CONFIG, rates: RATES,
    });
    expect(included.livingTargetAudMinor).toBe(excluded.livingTargetAudMinor - toMinorUnits(2817, "AUD"));
  });
});
