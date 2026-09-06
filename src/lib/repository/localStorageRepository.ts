import type { AppData, MoneyPlanBucketConfig, Settings } from "@/types";
import { buildDefaultCategories } from "@/lib/defaultCategories";
import type { DataRepository } from "./types";

const STORAGE_PREFIX = "money-os:v1:";

const KEYS = {
  settings: `${STORAGE_PREFIX}settings`,
  accounts: `${STORAGE_PREFIX}accounts`,
  transactions: `${STORAGE_PREFIX}transactions`,
  categories: `${STORAGE_PREFIX}categories`,
  recurringExpenses: `${STORAGE_PREFIX}recurringExpenses`,
  plannedExpenses: `${STORAGE_PREFIX}plannedExpenses`,
  plannedIncomes: `${STORAGE_PREFIX}plannedIncomes`,
  budgets: `${STORAGE_PREFIX}budgets`,
  importBatches: `${STORAGE_PREFIX}importBatches`,
  merchantRules: `${STORAGE_PREFIX}merchantRules`,
  exchangeRates: `${STORAGE_PREFIX}exchangeRates`,
  moneyPlans: `${STORAGE_PREFIX}moneyPlans`,
  moneyPlanBucketConfig: `${STORAGE_PREFIX}moneyPlanBucketConfig`,
} as const;

export const DEFAULT_SETTINGS: Settings = {
  baseCurrency: "AUD",
  reserveMinor: 0,
  reserveCurrency: "AUD",
  reserveConfirmed: false,
  availableHorizon: "END_OF_MONTH",
  hasSeenDemoNotice: false,
  demoDataActive: false,
  dataMigrationVersion: 0,
  dataMigrationSummary: null,
  bankScreenshotMigrationVersion: 0,
  bankScreenshotMigrationSummary: null,
};

export const DEFAULT_MONEY_PLAN_BUCKET_CONFIG: MoneyPlanBucketConfig = {
  koreaCardAccountId: null,
  auFixedAccountId: null,
  livingAccountId: null,
  reserveAccountId: null,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export class LocalStorageDataRepository implements DataRepository {
  async load(): Promise<AppData> {
    const categories = readJson(KEYS.categories, [] as AppData["categories"]);
    return {
      settings: readJson(KEYS.settings, DEFAULT_SETTINGS),
      accounts: readJson(KEYS.accounts, []),
      transactions: readJson(KEYS.transactions, []),
      categories: categories.length > 0 ? categories : buildDefaultCategories(),
      recurringExpenses: readJson(KEYS.recurringExpenses, []),
      plannedExpenses: readJson(KEYS.plannedExpenses, []),
      plannedIncomes: readJson(KEYS.plannedIncomes, []),
      budgets: readJson(KEYS.budgets, []),
      importBatches: readJson(KEYS.importBatches, []),
      merchantRules: readJson(KEYS.merchantRules, []),
      exchangeRates: readJson(KEYS.exchangeRates, [
        { pair: "AUD_KRW", rate: 900, updatedAt: new Date().toISOString() },
      ]),
      moneyPlans: readJson(KEYS.moneyPlans, []),
      moneyPlanBucketConfig: readJson(KEYS.moneyPlanBucketConfig, DEFAULT_MONEY_PLAN_BUCKET_CONFIG),
    };
  }

  async saveSettings(settings: Settings) {
    writeJson(KEYS.settings, settings);
  }
  async saveAccounts(items: AppData["accounts"]) {
    writeJson(KEYS.accounts, items);
  }
  async saveTransactions(items: AppData["transactions"]) {
    writeJson(KEYS.transactions, items);
  }
  async saveCategories(items: AppData["categories"]) {
    writeJson(KEYS.categories, items);
  }
  async saveRecurringExpenses(items: AppData["recurringExpenses"]) {
    writeJson(KEYS.recurringExpenses, items);
  }
  async savePlannedExpenses(items: AppData["plannedExpenses"]) {
    writeJson(KEYS.plannedExpenses, items);
  }
  async savePlannedIncomes(items: AppData["plannedIncomes"]) {
    writeJson(KEYS.plannedIncomes, items);
  }
  async saveBudgets(items: AppData["budgets"]) {
    writeJson(KEYS.budgets, items);
  }
  async saveImportBatches(items: AppData["importBatches"]) {
    writeJson(KEYS.importBatches, items);
  }
  async saveMerchantRules(items: AppData["merchantRules"]) {
    writeJson(KEYS.merchantRules, items);
  }
  async saveExchangeRates(items: AppData["exchangeRates"]) {
    writeJson(KEYS.exchangeRates, items);
  }
  async saveMoneyPlans(items: AppData["moneyPlans"]) {
    writeJson(KEYS.moneyPlans, items);
  }
  async saveMoneyPlanBucketConfig(config: MoneyPlanBucketConfig) {
    writeJson(KEYS.moneyPlanBucketConfig, config);
  }
  async clearAll() {
    if (typeof window === "undefined") return;
    Object.values(KEYS).forEach((key) => window.localStorage.removeItem(key));
  }
}
