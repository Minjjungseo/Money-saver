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
  | "YEARLY";

export interface RecurringExpense {
  id: string;
  name: string;
  amountMinor: number;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  nextDueDate: string; // ISO date
  essential: boolean;
  accountId: string | null;
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

/** Reserved for future per-category monthly budgets. Minimal for V1. */
export interface Budget {
  id: string;
  categoryId: string;
  monthlyLimitMinor: number;
  currency: CurrencyCode;
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
