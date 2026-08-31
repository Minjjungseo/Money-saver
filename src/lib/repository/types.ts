import type {
  Account,
  Budget,
  Category,
  ExchangeRate,
  ImportBatch,
  MerchantRule,
  MoneyPlanBucketConfig,
  MonthlyMoneyPlan,
  PlannedExpense,
  PlannedIncome,
  RecurringExpense,
  Settings,
  Transaction,
  AppData,
} from "@/types";

/**
 * Abstraction boundary between the app and its persistence mechanism.
 *
 * V1 ships a localStorage implementation (see localStorageRepository.ts).
 * To move to Supabase/Postgres later, implement this same interface against
 * the API/DB and swap the instance created in `repository/index.ts` — no
 * calling code (context, components) needs to change.
 */
export interface DataRepository {
  load(): Promise<AppData>;
  saveSettings(settings: Settings): Promise<void>;
  saveAccounts(items: Account[]): Promise<void>;
  saveTransactions(items: Transaction[]): Promise<void>;
  saveCategories(items: Category[]): Promise<void>;
  saveRecurringExpenses(items: RecurringExpense[]): Promise<void>;
  savePlannedExpenses(items: PlannedExpense[]): Promise<void>;
  savePlannedIncomes(items: PlannedIncome[]): Promise<void>;
  saveBudgets(items: Budget[]): Promise<void>;
  saveImportBatches(items: ImportBatch[]): Promise<void>;
  saveMerchantRules(items: MerchantRule[]): Promise<void>;
  saveExchangeRates(items: ExchangeRate[]): Promise<void>;
  saveMoneyPlans(items: MonthlyMoneyPlan[]): Promise<void>;
  saveMoneyPlanBucketConfig(config: MoneyPlanBucketConfig): Promise<void>;
  clearAll(): Promise<void>;
}
