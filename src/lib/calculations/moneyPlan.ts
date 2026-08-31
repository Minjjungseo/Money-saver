import { isWithinInterval } from "date-fns";
import type {
  Account,
  CurrencyCode,
  ExchangeRate,
  MoneyPlanBucketConfig,
  RecurringExpense,
  Transaction,
} from "@/types";
import { convertMinor } from "@/lib/money";
import { convertToBase, getAudKrwRate } from "@/lib/exchange";
import { categoryIdFor } from "@/lib/defaultCategories";
import { getMonthRange } from "./period";

/**
 * "이번 달 돈 배치" (Monthly Money Placement) — this is deliberately NOT the
 * same question as "계좌 총 잔액". It answers "which real account should this
 * money sit in, and how much of it still needs exchanging", using each
 * bucket's linked account's CURRENT balance plus what's still needed —
 * never re-deriving history from past transactions, and never double-
 * counting the same money across two buckets. See calculateMoneyPlan.
 */

export type MoneyPlanBucketKey = "KOREA_CARD" | "AU_FIXED" | "LIVING";
export type MoneyPlanBucketStatus = "SUFFICIENT" | "SHORT" | "NEEDS_ACCOUNT";

export interface MoneyPlanBucketResult {
  key: MoneyPlanBucketKey;
  label: string;
  accountId: string | null;
  accountName: string | null;
  currency: CurrencyCode;
  /** How much this bucket needs to hold this month, never negative. */
  requiredMinor: number;
  /** The linked account's current balance, converted into `currency`; null when no account is linked. */
  currentBalanceMinor: number | null;
  /** max(0, requiredMinor - currentBalanceMinor); 0 when sufficient or over. */
  shortfallMinor: number;
  status: MoneyPlanBucketStatus;
}

export interface MoneyPlanResult {
  month: string; // yyyy-MM
  totalBudgetKrwMinor: number;
  hyundaiCardKrwMinor: number;
  hyundaiCardIsAuto: boolean;
  remainingBudgetKrwMinor: number;
  remainingBudgetAudMinor: number;
  /** Raw AU fixed-cost figure (rent included/excluded per includeRent), never clamped. */
  auFixedAudMinor: number;
  /** remainingBudgetAudMinor - auFixedAudMinor — can be negative if the budget doesn't cover fixed costs; see budgetExceeded. */
  livingTargetAudMinor: number;
  /** True when the KRW budget minus 현대카드 doesn't even cover this month's AU fixed costs. */
  budgetExceeded: boolean;
  koreaCard: MoneyPlanBucketResult;
  auFixed: MoneyPlanBucketResult;
  living: MoneyPlanBucketResult;
  newExchangeNeededAudMinor: number;
  newExchangeNeededKrwMinor: number;
}

const ACCOUNT_NAME_PATTERNS: Record<"koreaCard" | "auFixed" | "living" | "hyundaiCard", RegExp> = {
  koreaCard: /신한/,
  auFixed: /commbank|커먼뱅크/i,
  living: /하나트래블로그|하나은행|하나/,
  hyundaiCard: /현대카드|현대/,
};

function findAccountByPattern(accounts: Account[], pattern: RegExp): Account | null {
  return accounts.find((a) => pattern.test(a.name) || pattern.test(a.bank)) ?? null;
}

/** Explicit config wins; otherwise falls back to matching an account by its usual Korean/Australian bank name. */
function resolveBucketAccountId(
  bucket: "koreaCard" | "auFixed" | "living",
  config: MoneyPlanBucketConfig,
  accounts: Account[]
): string | null {
  const configuredId = config[`${bucket}AccountId` as keyof MoneyPlanBucketConfig];
  if (configuredId && accounts.some((a) => a.id === configuredId)) return configuredId;
  return findAccountByPattern(accounts, ACCOUNT_NAME_PATTERNS[bucket])?.id ?? null;
}

/**
 * This month's actual spend on the matched 현대카드 account, in KRW —
 * EXPENSE/CASH_WITHDRAWAL add, REFUND offsets, mirroring calculateMonthlyExpense.
 * Returns 0 (not null) when no 현대카드 account can be found, since the caller
 * treats "no card found" the same as "nothing charged yet" for the auto figure.
 */
export function calculateHyundaiCardAutoKrwMinor(
  transactions: Transaction[],
  accounts: Account[],
  monthDate: Date,
  rates: ExchangeRate[]
): number {
  const card = findAccountByPattern(accounts, ACCOUNT_NAME_PATTERNS.hyundaiCard);
  if (!card) return 0;
  const { start, end } = getMonthRange(monthDate);
  return transactions
    .filter(
      (t) =>
        t.accountId === card.id &&
        isWithinInterval(new Date(`${t.date}T00:00:00`), { start, end })
    )
    .reduce((sum, t) => {
      const krw = convertToBase(t.amountMinor, t.currency, "KRW", rates);
      if (t.transactionType === "EXPENSE" || t.transactionType === "CASH_WITHDRAWAL") return sum + krw;
      if (t.transactionType === "REFUND") return sum - krw;
      return sum;
    }, 0);
}

/**
 * This month's AU-local fixed-cost figure: the same monthly-equivalent sum
 * the HOME 고정지출 card uses (livingBudgetImpact === "INCLUDED" items),
 * optionally excluding rent so it can be tracked separately per includeRent.
 */
export function calculateAuFixedCostMinor(
  recurringExpenses: RecurringExpense[],
  includeRent: boolean,
  baseCurrency: CurrencyCode,
  rates: ExchangeRate[]
): number {
  const rentCategoryId = categoryIdFor("housing_rent");
  return recurringExpenses
    .filter((r) => r.livingBudgetImpact === "INCLUDED")
    .filter((r) => includeRent || r.categoryId !== rentCategoryId)
    .reduce((sum, r) => {
      const figureMinor = r.monthlyEquivalentMinor ?? r.amountMinor ?? 0;
      return sum + convertToBase(figureMinor, r.currency, baseCurrency, rates);
    }, 0);
}

function buildBucket(
  key: MoneyPlanBucketKey,
  label: string,
  accountId: string | null,
  accounts: Account[],
  currency: CurrencyCode,
  rawRequiredMinor: number,
  audKrwRate: number
): MoneyPlanBucketResult {
  const requiredMinor = Math.max(0, Math.round(rawRequiredMinor));
  const account = accounts.find((a) => a.id === accountId) ?? null;

  if (!account) {
    return {
      key,
      label,
      accountId: null,
      accountName: null,
      currency,
      requiredMinor,
      currentBalanceMinor: null,
      shortfallMinor: requiredMinor,
      status: "NEEDS_ACCOUNT",
    };
  }

  const currentBalanceMinor = convertMinor(account.balanceMinor, account.currency, currency, audKrwRate);
  const shortfallMinor = Math.max(0, requiredMinor - currentBalanceMinor);

  return {
    key,
    label,
    accountId: account.id,
    accountName: account.name,
    currency,
    requiredMinor,
    currentBalanceMinor,
    shortfallMinor,
    status: shortfallMinor > 0 ? "SHORT" : "SUFFICIENT",
  };
}

export function calculateMoneyPlan(params: {
  month: Date;
  monthKey: string;
  totalBudgetKrwMinor: number;
  hyundaiCardOverrideKrwMinor: number | null;
  includeRent: boolean;
  transactions: Transaction[];
  accounts: Account[];
  recurringExpenses: RecurringExpense[];
  bucketConfig: MoneyPlanBucketConfig;
  rates: ExchangeRate[];
}): MoneyPlanResult {
  const {
    month,
    monthKey,
    totalBudgetKrwMinor,
    hyundaiCardOverrideKrwMinor,
    includeRent,
    transactions,
    accounts,
    recurringExpenses,
    bucketConfig,
    rates,
  } = params;

  const audKrwRate = getAudKrwRate(rates);

  const hyundaiCardIsAuto = hyundaiCardOverrideKrwMinor === null;
  const hyundaiCardKrwMinor = hyundaiCardIsAuto
    ? calculateHyundaiCardAutoKrwMinor(transactions, accounts, month, rates)
    : hyundaiCardOverrideKrwMinor;

  const remainingBudgetKrwMinor = totalBudgetKrwMinor - hyundaiCardKrwMinor;
  const remainingBudgetAudMinor = convertMinor(remainingBudgetKrwMinor, "KRW", "AUD", audKrwRate);

  const auFixedAudMinor = calculateAuFixedCostMinor(recurringExpenses, includeRent, "AUD", rates);
  const livingTargetAudMinor = remainingBudgetAudMinor - auFixedAudMinor;
  const budgetExceeded = livingTargetAudMinor < 0;

  const koreaCardAccountId = resolveBucketAccountId("koreaCard", bucketConfig, accounts);
  const auFixedAccountId = resolveBucketAccountId("auFixed", bucketConfig, accounts);
  const livingAccountId = resolveBucketAccountId("living", bucketConfig, accounts);

  const koreaCard = buildBucket("KOREA_CARD", "한국 카드 결제용", koreaCardAccountId, accounts, "KRW", hyundaiCardKrwMinor, audKrwRate);
  const auFixed = buildBucket("AU_FIXED", "호주 현지 고정비", auFixedAccountId, accounts, "AUD", auFixedAudMinor, audKrwRate);
  const living = buildBucket("LIVING", "생활비", livingAccountId, accounts, "AUD", livingTargetAudMinor, audKrwRate);

  const newExchangeNeededAudMinor = auFixed.shortfallMinor + living.shortfallMinor;
  const newExchangeNeededKrwMinor = convertMinor(newExchangeNeededAudMinor, "AUD", "KRW", audKrwRate);

  return {
    month: monthKey,
    totalBudgetKrwMinor,
    hyundaiCardKrwMinor,
    hyundaiCardIsAuto,
    remainingBudgetKrwMinor,
    remainingBudgetAudMinor,
    auFixedAudMinor,
    livingTargetAudMinor,
    budgetExceeded,
    koreaCard,
    auFixed,
    living,
    newExchangeNeededAudMinor,
    newExchangeNeededKrwMinor,
  };
}
