/**
 * Core domain types for Money OS.
 *
 * Money convention: every amount is stored as an integer in the currency's
 * "minor unit" (see MINOR_UNIT_SCALE in lib/money.ts) to avoid floating point
 * drift. AUD uses cents (scale 100), KRW has no practical subunit (scale 1).
 */

export type CurrencyCode = "AUD" | "KRW";

export type TransactionType =
  | "EXPENSE"
  | "INCOME"
  | "TRANSFER"
  | "EXCHANGE"
  | "REFUND"
  | "CASH_WITHDRAWAL";

/** Transaction types that count toward monthly income/expense totals. */
export const CASH_FLOW_TYPES: readonly TransactionType[] = [
  "EXPENSE",
  "INCOME",
  "REFUND",
  "CASH_WITHDRAWAL",
];

export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CASH"
  | "CREDIT_CARD"
  | "INVESTMENT"
  | "OTHER";

export interface Account {
  id: string;
  name: string;
  bank: string;
  currency: CurrencyCode;
  /** Current balance in minor units of `currency`. */
  balanceMinor: number;
  /**
   * ISO date (yyyy-MM-dd) the balance was last confirmed by the user, or null
   * if it has never been confirmed. A null/undefined value is NOT the same as
   * a zero balance — it means "unknown", not "empty account". Set whenever
   * the user saves a balance through the account form; left null by CSV
   * import unless the file explicitly supplies a confirmation date.
   */
  balanceAsOfDate: string | null;
  type: AccountType;
  includeInAvailable: boolean;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  /** Subcategory names for a top-level category (empty for subcategories themselves). */
  isIncome?: boolean;
  isSystem?: boolean;
  sortOrder: number;
}

export type TransactionSource = "MANUAL" | "IMAGE_IMPORT" | "CSV_IMPORT" | "JSON_IMPORT";

/**
 * Who/what a transaction's spend belongs to — independent of its category
 * AND independent of how often it recurs (see ExpenseBehavior below). A
 * subscription can be a BUSINESS expense that's also FIXED (Figma) or a
 * HOUSEHOLD expense that's also FIXED (Netflix) — these are two separate
 * questions, so they're two separate fields, not one combined value.
 */
export type ExpenseScope = "HOUSEHOLD" | "BUSINESS" | "SEPARATE" | "TRANSFER";

/** How regularly a transaction's spend repeats. Orthogonal to ExpenseScope — see above. */
export type ExpenseBehavior = "FIXED" | "VARIABLE" | "ONE_TIME";

export interface Transaction {
  id: string;
  date: string; // ISO date (yyyy-MM-dd)
  merchant: string;
  /** Absolute amount in minor units of `currency`. Sign is derived from transactionType. */
  amountMinor: number;
  currency: CurrencyCode;
  transactionType: TransactionType;
  categoryId: string | null;
  subcategory: string | null;
  accountId: string | null;
  memo: string;
  source: TransactionSource;
  importBatchId: string | null;
  aiConfidence: number | null; // 0-100
  reviewed: boolean;
  originalFileRef: string | null;
  /** For TRANSFER: the counterpart account, if known. */
  transferAccountId?: string | null;
  /** Explicit override; when null/undefined it's inferred — see resolveExpenseScope(). */
  scope?: ExpenseScope | null;
  /** Explicit override; when null/undefined it's inferred — see resolveExpenseBehavior(). */
  expenseBehavior?: ExpenseBehavior | null;
  /** Raw source-system category label, preserved verbatim for audit (e.g. Notion's "분류": "📱 구독·사업"). Never used for calculation — only scope/expenseBehavior are. */
  sourceClassification?: string | null;
  /** Raw source-system "성격"-style label, preserved verbatim for audit (e.g. "생활비"). Note this is NOT a business/personal split in the source system — see ExpenseScope for that. */
  sourceNature?: string | null;
  /** Raw source-system recurrence label, preserved verbatim for audit (e.g. "고정"/"변동"/"일회성"). */
  sourceFixedVariable?: string | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RecurringFrequency =
  | "WEEKLY"
  | "FORTNIGHTLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SIX_MONTHLY"
  | "YEARLY"
  | "CUSTOM"
  /** Billed per school term / irregular schedule — no fixed advance rule, so occurrences aren't auto-projected. */
  | "TERM_BASED";

export type IntervalUnit = "WEEK" | "MONTH";

export interface CustomInterval {
  unit: IntervalUnit;
  count: number;
}

/**
 * Whether an item counts toward the household's regular monthly living-cost
 * budget ("생활비 포함"), or is tracked separately from it ("생활비 별도") —
 * e.g. rent is a large fixed cost the household budgets for on its own,
 * outside the day-to-day living budget. Undefined/null means "not classified"
 * and the item is left out of the fixed-cost summary entirely.
 */
export type LivingBudgetImpact = "INCLUDED" | "SEPARATE";

/**
 * ACTIVE: amount and nextDueDate are both confirmed real values, safe to use
 * for near-term forecasting ("앞으로 나갈 필수 지출"). NEEDS_CONFIRMATION: at
 * least one of them is unknown — never guessed or defaulted to today/zero,
 * so the item is excluded from that forecast until a person fills it in.
 */
export type RecurringExpenseStatus = "ACTIVE" | "NEEDS_CONFIRMATION";

export interface RecurringExpense {
  id: string;
  name: string;
  /**
   * The real amount actually charged per `frequency` cycle (e.g. A$650 for a
   * WEEKLY rent payment) — null when the real amount isn't confirmed yet
   * (see `status`). This is never a monthly average; use `monthlyEquivalentMinor`
   * for that.
   */
  amountMinor: number | null;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  /** Required when frequency === "CUSTOM"; ignored otherwise. e.g. every 2 months = { unit: "MONTH", count: 2 }. */
  customInterval?: CustomInterval | null;
  /**
   * A separate, explicit monthly-budget reference figure for items whose real
   * cycle isn't monthly (e.g. A$2,817/월 for a WEEKLY A$650 rent payment).
   * Forecast/budget use only — never treated as the real per-cycle amount.
   */
  monthlyEquivalentMinor?: number | null;
  /** ISO date, or null when not yet confirmed — never a guessed/default date. See `status`. */
  nextDueDate: string | null;
  /** Derived from whether amount + nextDueDate are both confirmed; see RecurringExpenseStatus. */
  status: RecurringExpenseStatus;
  essential: boolean;
  accountId: string | null;
  /**
   * Free-text note on where payment actually settles, for cases the single
   * `accountId` can't express, e.g. a credit card billed to a bank that isn't
   * itself a modeled Account ("신한은행에서 결제"). Null when accountId alone
   * is a complete description.
   */
  paymentNote?: string | null;
  /**
   * Free-text note on the real (non-monthly) billing cycle, and any other
   * budget/forecast context (e.g. a total-through-date reference figure).
   * Null when `amountMinor` already fully describes the real billing cycle.
   */
  actualCycleNote?: string | null;
  /** How this item counts toward the monthly living budget; see LivingBudgetImpact. */
  livingBudgetImpact?: LivingBudgetImpact | null;
  startDate: string;
  endDate: string | null;
  categoryId: string | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PlannedExpenseStatus = "PLANNED" | "PAID" | "CANCELLED";

export interface PlannedExpense {
  id: string;
  date: string;
  name: string;
  expectedAmountMinor: number;
  currency: CurrencyCode;
  essential: boolean;
  accountId: string | null;
  status: PlannedExpenseStatus;
  categoryId: string | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedIncome {
  id: string;
  name: string;
  amountMinor: number;
  expectedDate: string;
  currency: CurrencyCode;
  confirmed: boolean;
  source: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BudgetPeriod = "WEEKLY" | "MONTHLY";

/** A simple spending target for a period, optionally scoped to one category. */
export interface BudgetSubItem {
  name: string;
  amountMinor: number;
}

export interface Budget {
  id: string;
  name: string;
  amountMinor: number;
  currency: CurrencyCode;
  period: BudgetPeriod;
  categoryId: string | null;
  active: boolean;
  /**
   * Optional named breakdown of `amountMinor` for the person's own planning
   * reference (e.g. 장보기/외식·카페/쇼핑·아이/교통·기타 under one 생활비
   * budget). Display/editing only — spend matching always uses the whole
   * budget (categoryId, if set), never these sub-items individually.
   */
  subItems?: BudgetSubItem[] | null;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImportBatch {
  id: string;
  source: TransactionSource;
  fileRef: string | null;
  createdAt: string;
  transactionIds: string[];
}

export interface MerchantRule {
  id: string;
  /** Uppercased merchant match key (substring match). */
  merchantPattern: string;
  categoryId: string;
  subcategory: string | null;
  /** How many times this rule has been confirmed by a user correction. */
  confidence: number;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeRate {
  /** e.g. "AUD_KRW" meaning 1 AUD = rate KRW */
  pair: string;
  rate: number;
  updatedAt: string;
}

export type AvailableHorizon = "END_OF_MONTH" | "30_DAYS" | "90_DAYS";

export interface Settings {
  baseCurrency: CurrencyCode;
  reserveMinor: number;
  reserveCurrency: CurrencyCode;
  /** Whether the user has explicitly reviewed/saved the reserve amount, vs. it just being the untouched default. */
  reserveConfirmed: boolean;
  availableHorizon: AvailableHorizon;
  hasSeenDemoNotice: boolean;
  demoDataActive: boolean;
}

export interface AppData {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  recurringExpenses: RecurringExpense[];
  plannedExpenses: PlannedExpense[];
  plannedIncomes: PlannedIncome[];
  budgets: Budget[];
  importBatches: ImportBatch[];
  merchantRules: MerchantRule[];
  exchangeRates: ExchangeRate[];
  settings: Settings;
}

/** A candidate transaction produced by the image parser, pending user review. */
export interface ParsedTransactionCandidate {
  id: string;
  date: string;
  merchant: string;
  amountMinor: number;
  currency: CurrencyCode;
  transactionType: TransactionType;
  suggestedCategoryId: string | null;
  suggestedSubcategory: string | null;
  suggestedAccountId: string | null;
  confidence: number;
  possibleDuplicateOfId: string | null;
}
