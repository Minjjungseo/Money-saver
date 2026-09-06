"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  Account,
  AppData,
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
} from "@/types";
import { repository, DEFAULT_SETTINGS, DEFAULT_MONEY_PLAN_BUCKET_CONFIG } from "@/lib/repository";
import { buildDemoData } from "@/lib/demoData";
import { buildDefaultCategories } from "@/lib/defaultCategories";
import { generateId, nowIso } from "@/lib/id";
import { DATA_MIGRATION_TARGET_VERSION, runDataMigration } from "@/lib/migrations/dataMigration";
import {
  BANK_SCREENSHOT_MIGRATION_TARGET_VERSION,
  addKnownBankScreenshotTransactions,
} from "@/lib/migrations/bankScreenshotTransactions2026";

const INIT_FLAG_KEY = "money-os:v1:initialized";

const EMPTY_DATA: AppData = {
  accounts: [],
  transactions: [],
  categories: buildDefaultCategories(),
  recurringExpenses: [],
  plannedExpenses: [],
  plannedIncomes: [],
  budgets: [],
  importBatches: [],
  merchantRules: [],
  exchangeRates: [{ pair: "AUD_KRW", rate: 900, updatedAt: nowIso() }],
  settings: DEFAULT_SETTINGS,
  moneyPlans: [],
  moneyPlanBucketConfig: DEFAULT_MONEY_PLAN_BUCKET_CONFIG,
};

interface DataContextValue {
  data: AppData;
  loading: boolean;

  addAccount(input: Omit<Account, "id" | "createdAt" | "updatedAt">): Account;
  updateAccount(id: string, patch: Partial<Account>): void;
  deleteAccount(id: string): void;

  addTransaction(input: Omit<Transaction, "id" | "createdAt" | "updatedAt">): Transaction;
  updateTransaction(id: string, patch: Partial<Transaction>): void;
  deleteTransaction(id: string): void;
  bulkAddTransactions(
    inputs: Omit<Transaction, "id" | "createdAt" | "updatedAt">[],
    batch: Omit<ImportBatch, "id" | "createdAt" | "transactionIds">
  ): Transaction[];

  addRecurringExpense(input: Omit<RecurringExpense, "id" | "createdAt" | "updatedAt">): RecurringExpense;
  updateRecurringExpense(id: string, patch: Partial<RecurringExpense>): void;
  deleteRecurringExpense(id: string): void;

  addPlannedExpense(input: Omit<PlannedExpense, "id" | "createdAt" | "updatedAt">): PlannedExpense;
  updatePlannedExpense(id: string, patch: Partial<PlannedExpense>): void;
  deletePlannedExpense(id: string): void;

  addPlannedIncome(input: Omit<PlannedIncome, "id" | "createdAt" | "updatedAt">): PlannedIncome;
  updatePlannedIncome(id: string, patch: Partial<PlannedIncome>): void;
  deletePlannedIncome(id: string): void;

  addCategory(input: Omit<Category, "id">): Category;
  updateCategory(id: string, patch: Partial<Category>): void;
  deleteCategory(id: string): void;

  upsertMerchantRule(merchantPattern: string, categoryId: string, subcategory: string | null): void;
  deleteMerchantRule(id: string): void;

  addBudget(input: Omit<Budget, "id" | "createdAt" | "updatedAt">): Budget;
  updateBudget(id: string, patch: Partial<Budget>): void;
  deleteBudget(id: string): void;

  updateSettings(patch: Partial<Settings>): void;
  updateBudgets(items: Budget[]): void;
  updateExchangeRate(pair: string, rate: number): void;

  /** Creates the month's plan with defaults if missing, else merges `patch` into the existing one. Upsert by `month` (yyyy-MM) — never duplicates. */
  upsertMoneyPlan(
    month: string,
    patch: Partial<Pick<MonthlyMoneyPlan, "totalBudgetKrwMinor" | "hyundaiCardOverrideKrwMinor" | "includeRent">>
  ): MonthlyMoneyPlan;
  updateMoneyPlanBucketConfig(patch: Partial<MoneyPlanBucketConfig>): void;

  clearDemoData(): void;
  resetAllData(): void;
  seedDemoData(): void;
  replaceAllData(next: AppData): void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await repository.load();
      const initialized = typeof window !== "undefined" && window.localStorage.getItem(INIT_FLAG_KEY);
      const isEmpty = loaded.accounts.length === 0 && loaded.transactions.length === 0;

      if (!initialized && isEmpty) {
        const demo = buildDemoData(new Date());
        await Promise.all([
          repository.saveSettings(demo.settings),
          repository.saveAccounts(demo.accounts),
          repository.saveTransactions(demo.transactions),
          repository.saveCategories(demo.categories),
          repository.saveRecurringExpenses(demo.recurringExpenses),
          repository.savePlannedExpenses(demo.plannedExpenses),
          repository.savePlannedIncomes(demo.plannedIncomes),
          repository.saveBudgets(demo.budgets),
          repository.saveMerchantRules(demo.merchantRules),
          repository.saveExchangeRates(demo.exchangeRates),
        ]);
        if (typeof window !== "undefined") window.localStorage.setItem(INIT_FLAG_KEY, "true");
        if (!cancelled) setData(demo);
      } else {
        if (typeof window !== "undefined") window.localStorage.setItem(INIT_FLAG_KEY, "true");

        let finalData = loaded;
        if ((loaded.settings.dataMigrationVersion ?? 0) < DATA_MIGRATION_TARGET_VERSION) {
          try {
            const { data: migrated, summary } = runDataMigration(loaded);
            finalData = {
              ...migrated,
              settings: {
                ...migrated.settings,
                dataMigrationVersion: DATA_MIGRATION_TARGET_VERSION,
                dataMigrationSummary: summary,
              },
            };
            await Promise.all([
              repository.saveTransactions(finalData.transactions),
              repository.saveRecurringExpenses(finalData.recurringExpenses),
              repository.saveBudgets(finalData.budgets),
              repository.saveSettings(finalData.settings),
            ]);
          } catch (err) {
            // Never advance dataMigrationVersion on failure — the migration
            // retries on the next load. loaded (pre-migration) data is used
            // as-is so a migration bug never blocks the app from opening.
            console.error("Money OS data migration failed; will retry on next load.", err);
            finalData = loaded;
          }
        }

        if ((finalData.settings.bankScreenshotMigrationVersion ?? 0) < BANK_SCREENSHOT_MIGRATION_TARGET_VERSION) {
          try {
            const { transactions, added, duplicatesSkipped, pendingExcluded } = addKnownBankScreenshotTransactions(finalData);
            finalData = {
              ...finalData,
              transactions,
              settings: {
                ...finalData.settings,
                bankScreenshotMigrationVersion: BANK_SCREENSHOT_MIGRATION_TARGET_VERSION,
                bankScreenshotMigrationSummary: { version: BANK_SCREENSHOT_MIGRATION_TARGET_VERSION, ranAt: nowIso(), added, duplicatesSkipped, pendingExcluded },
              },
            };
            await Promise.all([repository.saveTransactions(finalData.transactions), repository.saveSettings(finalData.settings)]);
          } catch (err) {
            // Same never-advance-on-failure contract as the migration above.
            console.error("Money OS bank-screenshot transaction addition failed; will retry on next load.", err);
          }
        }

        if (!cancelled) setData(finalData);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addAccount = useCallback<DataContextValue["addAccount"]>((input) => {
    const account: Account = { ...input, id: generateId("acc"), createdAt: nowIso(), updatedAt: nowIso() };
    setData((prev) => {
      const accounts = [...prev.accounts, account];
      repository.saveAccounts(accounts);
      return { ...prev, accounts };
    });
    return account;
  }, []);

  const updateAccount = useCallback<DataContextValue["updateAccount"]>((id, patch) => {
    setData((prev) => {
      const accounts = prev.accounts.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: nowIso() } : a));
      repository.saveAccounts(accounts);
      return { ...prev, accounts };
    });
  }, []);

  const deleteAccount = useCallback<DataContextValue["deleteAccount"]>((id) => {
    setData((prev) => {
      const accounts = prev.accounts.filter((a) => a.id !== id);
      repository.saveAccounts(accounts);
      return { ...prev, accounts };
    });
  }, []);

  const addTransaction = useCallback<DataContextValue["addTransaction"]>((input) => {
    const transaction: Transaction = { ...input, id: generateId("txn"), createdAt: nowIso(), updatedAt: nowIso() };
    setData((prev) => {
      const transactions = [transaction, ...prev.transactions];
      repository.saveTransactions(transactions);
      return { ...prev, transactions };
    });
    return transaction;
  }, []);

  const updateTransaction = useCallback<DataContextValue["updateTransaction"]>((id, patch) => {
    setData((prev) => {
      const transactions = prev.transactions.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: nowIso() } : t
      );
      repository.saveTransactions(transactions);
      return { ...prev, transactions };
    });
  }, []);

  const deleteTransaction = useCallback<DataContextValue["deleteTransaction"]>((id) => {
    setData((prev) => {
      const transactions = prev.transactions.filter((t) => t.id !== id);
      repository.saveTransactions(transactions);
      return { ...prev, transactions };
    });
  }, []);

  const bulkAddTransactions = useCallback<DataContextValue["bulkAddTransactions"]>((inputs, batchInput) => {
    const createdTransactions: Transaction[] = inputs.map((input) => ({
      ...input,
      id: generateId("txn"),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }));
    const batch: ImportBatch = {
      ...batchInput,
      id: generateId("batch"),
      createdAt: nowIso(),
      transactionIds: createdTransactions.map((t) => t.id),
    };
    setData((prev) => {
      const transactions = [...createdTransactions, ...prev.transactions];
      const importBatches = [batch, ...prev.importBatches];
      repository.saveTransactions(transactions);
      repository.saveImportBatches(importBatches);
      return { ...prev, transactions, importBatches };
    });
    return createdTransactions;
  }, []);

  const addRecurringExpense = useCallback<DataContextValue["addRecurringExpense"]>((input) => {
    const item: RecurringExpense = { ...input, id: generateId("rec"), createdAt: nowIso(), updatedAt: nowIso() };
    setData((prev) => {
      const recurringExpenses = [...prev.recurringExpenses, item];
      repository.saveRecurringExpenses(recurringExpenses);
      return { ...prev, recurringExpenses };
    });
    return item;
  }, []);

  const updateRecurringExpense = useCallback<DataContextValue["updateRecurringExpense"]>((id, patch) => {
    setData((prev) => {
      const recurringExpenses = prev.recurringExpenses.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: nowIso() } : r
      );
      repository.saveRecurringExpenses(recurringExpenses);
      return { ...prev, recurringExpenses };
    });
  }, []);

  const deleteRecurringExpense = useCallback<DataContextValue["deleteRecurringExpense"]>((id) => {
    setData((prev) => {
      const recurringExpenses = prev.recurringExpenses.filter((r) => r.id !== id);
      repository.saveRecurringExpenses(recurringExpenses);
      return { ...prev, recurringExpenses };
    });
  }, []);

  const addPlannedExpense = useCallback<DataContextValue["addPlannedExpense"]>((input) => {
    const item: PlannedExpense = { ...input, id: generateId("plexp"), createdAt: nowIso(), updatedAt: nowIso() };
    setData((prev) => {
      const plannedExpenses = [...prev.plannedExpenses, item];
      repository.savePlannedExpenses(plannedExpenses);
      return { ...prev, plannedExpenses };
    });
    return item;
  }, []);

  const updatePlannedExpense = useCallback<DataContextValue["updatePlannedExpense"]>((id, patch) => {
    setData((prev) => {
      const plannedExpenses = prev.plannedExpenses.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p
      );
      repository.savePlannedExpenses(plannedExpenses);
      return { ...prev, plannedExpenses };
    });
  }, []);

  const deletePlannedExpense = useCallback<DataContextValue["deletePlannedExpense"]>((id) => {
    setData((prev) => {
      const plannedExpenses = prev.plannedExpenses.filter((p) => p.id !== id);
      repository.savePlannedExpenses(plannedExpenses);
      return { ...prev, plannedExpenses };
    });
  }, []);

  const addPlannedIncome = useCallback<DataContextValue["addPlannedIncome"]>((input) => {
    const item: PlannedIncome = { ...input, id: generateId("plinc"), createdAt: nowIso(), updatedAt: nowIso() };
    setData((prev) => {
      const plannedIncomes = [...prev.plannedIncomes, item];
      repository.savePlannedIncomes(plannedIncomes);
      return { ...prev, plannedIncomes };
    });
    return item;
  }, []);

  const updatePlannedIncome = useCallback<DataContextValue["updatePlannedIncome"]>((id, patch) => {
    setData((prev) => {
      const plannedIncomes = prev.plannedIncomes.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: nowIso() } : p
      );
      repository.savePlannedIncomes(plannedIncomes);
      return { ...prev, plannedIncomes };
    });
  }, []);

  const deletePlannedIncome = useCallback<DataContextValue["deletePlannedIncome"]>((id) => {
    setData((prev) => {
      const plannedIncomes = prev.plannedIncomes.filter((p) => p.id !== id);
      repository.savePlannedIncomes(plannedIncomes);
      return { ...prev, plannedIncomes };
    });
  }, []);

  const addCategory = useCallback<DataContextValue["addCategory"]>((input) => {
    const item: Category = { ...input, id: generateId("cat") };
    setData((prev) => {
      const categories = [...prev.categories, item];
      repository.saveCategories(categories);
      return { ...prev, categories };
    });
    return item;
  }, []);

  const updateCategory = useCallback<DataContextValue["updateCategory"]>((id, patch) => {
    setData((prev) => {
      const categories = prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
      repository.saveCategories(categories);
      return { ...prev, categories };
    });
  }, []);

  const deleteCategory = useCallback<DataContextValue["deleteCategory"]>((id) => {
    setData((prev) => {
      const categories = prev.categories.filter((c) => c.id !== id && c.parentId !== id);
      repository.saveCategories(categories);
      return { ...prev, categories };
    });
  }, []);

  const upsertMerchantRule = useCallback<DataContextValue["upsertMerchantRule"]>(
    (merchantPattern, categoryId, subcategory) => {
      setData((prev) => {
        const key = merchantPattern.trim().toUpperCase();
        const existing = prev.merchantRules.find((r) => r.merchantPattern === key);
        let merchantRules: MerchantRule[];
        if (existing) {
          merchantRules = prev.merchantRules.map((r) =>
            r.id === existing.id
              ? { ...r, categoryId, subcategory, confidence: r.confidence + 1, updatedAt: nowIso() }
              : r
          );
        } else {
          merchantRules = [
            ...prev.merchantRules,
            {
              id: generateId("rule"),
              merchantPattern: key,
              categoryId,
              subcategory,
              confidence: 1,
              createdAt: nowIso(),
              updatedAt: nowIso(),
            },
          ];
        }
        repository.saveMerchantRules(merchantRules);
        return { ...prev, merchantRules };
      });
    },
    []
  );

  const deleteMerchantRule = useCallback<DataContextValue["deleteMerchantRule"]>((id) => {
    setData((prev) => {
      const merchantRules = prev.merchantRules.filter((r) => r.id !== id);
      repository.saveMerchantRules(merchantRules);
      return { ...prev, merchantRules };
    });
  }, []);

  const updateSettings = useCallback<DataContextValue["updateSettings"]>((patch) => {
    setData((prev) => {
      const settings = { ...prev.settings, ...patch };
      repository.saveSettings(settings);
      return { ...prev, settings };
    });
  }, []);

  const addBudget = useCallback<DataContextValue["addBudget"]>((input) => {
    const item: Budget = { ...input, id: generateId("budget"), createdAt: nowIso(), updatedAt: nowIso() };
    setData((prev) => {
      const budgets = [...prev.budgets, item];
      repository.saveBudgets(budgets);
      return { ...prev, budgets };
    });
    return item;
  }, []);

  const updateBudget = useCallback<DataContextValue["updateBudget"]>((id, patch) => {
    setData((prev) => {
      const budgets = prev.budgets.map((b) => (b.id === id ? { ...b, ...patch, updatedAt: nowIso() } : b));
      repository.saveBudgets(budgets);
      return { ...prev, budgets };
    });
  }, []);

  const deleteBudget = useCallback<DataContextValue["deleteBudget"]>((id) => {
    setData((prev) => {
      const budgets = prev.budgets.filter((b) => b.id !== id);
      repository.saveBudgets(budgets);
      return { ...prev, budgets };
    });
  }, []);

  const updateBudgets = useCallback<DataContextValue["updateBudgets"]>((items) => {
    setData((prev) => {
      repository.saveBudgets(items);
      return { ...prev, budgets: items };
    });
  }, []);

  const updateExchangeRate = useCallback<DataContextValue["updateExchangeRate"]>((pair, rate) => {
    setData((prev) => {
      const existing = prev.exchangeRates.find((r) => r.pair === pair);
      const exchangeRates: ExchangeRate[] = existing
        ? prev.exchangeRates.map((r) => (r.pair === pair ? { ...r, rate, updatedAt: nowIso() } : r))
        : [...prev.exchangeRates, { pair, rate, updatedAt: nowIso() }];
      repository.saveExchangeRates(exchangeRates);
      return { ...prev, exchangeRates };
    });
  }, []);

  const upsertMoneyPlan = useCallback<DataContextValue["upsertMoneyPlan"]>((month, patch) => {
    let result!: MonthlyMoneyPlan;
    setData((prev) => {
      const existing = prev.moneyPlans.find((p) => p.month === month);
      let moneyPlans: MonthlyMoneyPlan[];
      if (existing) {
        result = { ...existing, ...patch, updatedAt: nowIso() };
        moneyPlans = prev.moneyPlans.map((p) => (p.month === month ? result : p));
      } else {
        result = {
          id: generateId("moneyplan"),
          month,
          totalBudgetKrwMinor: 0,
          hyundaiCardOverrideKrwMinor: null,
          includeRent: true,
          ...patch,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        moneyPlans = [...prev.moneyPlans, result];
      }
      repository.saveMoneyPlans(moneyPlans);
      return { ...prev, moneyPlans };
    });
    return result;
  }, []);

  const updateMoneyPlanBucketConfig = useCallback<DataContextValue["updateMoneyPlanBucketConfig"]>((patch) => {
    setData((prev) => {
      const moneyPlanBucketConfig = { ...prev.moneyPlanBucketConfig, ...patch };
      repository.saveMoneyPlanBucketConfig(moneyPlanBucketConfig);
      return { ...prev, moneyPlanBucketConfig };
    });
  }, []);

  const clearDemoData = useCallback(() => {
    setData((prev) => {
      const next: AppData = {
        ...prev,
        accounts: prev.accounts.filter((a) => !a.isDemo),
        transactions: prev.transactions.filter((t) => !t.isDemo),
        recurringExpenses: prev.recurringExpenses.filter((r) => !r.isDemo),
        plannedExpenses: prev.plannedExpenses.filter((p) => !p.isDemo),
        plannedIncomes: prev.plannedIncomes.filter((p) => !p.isDemo),
        budgets: prev.budgets.filter((b) => !b.isDemo),
        merchantRules: prev.merchantRules.filter((m) => !m.isDemo),
        settings: { ...prev.settings, demoDataActive: false },
      };
      repository.saveAccounts(next.accounts);
      repository.saveTransactions(next.transactions);
      repository.saveRecurringExpenses(next.recurringExpenses);
      repository.savePlannedExpenses(next.plannedExpenses);
      repository.savePlannedIncomes(next.plannedIncomes);
      repository.saveBudgets(next.budgets);
      repository.saveMerchantRules(next.merchantRules);
      repository.saveSettings(next.settings);
      return next;
    });
  }, []);

  const resetAllData = useCallback(() => {
    repository.clearAll();
    if (typeof window !== "undefined") window.localStorage.setItem(INIT_FLAG_KEY, "true");
    const fresh: AppData = { ...EMPTY_DATA, categories: buildDefaultCategories() };
    repository.saveCategories(fresh.categories);
    repository.saveSettings(fresh.settings);
    repository.saveExchangeRates(fresh.exchangeRates);
    setData(fresh);
  }, []);

  const seedDemoData = useCallback(() => {
    const demo = buildDemoData(new Date());
    repository.saveSettings(demo.settings);
    repository.saveAccounts(demo.accounts);
    repository.saveTransactions(demo.transactions);
    repository.saveCategories(demo.categories);
    repository.saveRecurringExpenses(demo.recurringExpenses);
    repository.savePlannedExpenses(demo.plannedExpenses);
    repository.savePlannedIncomes(demo.plannedIncomes);
    repository.saveBudgets(demo.budgets);
    repository.saveMerchantRules(demo.merchantRules);
    repository.saveExchangeRates(demo.exchangeRates);
    setData(demo);
  }, []);

  const replaceAllData = useCallback((next: AppData) => {
    repository.saveSettings(next.settings);
    repository.saveAccounts(next.accounts);
    repository.saveTransactions(next.transactions);
    repository.saveCategories(next.categories);
    repository.saveRecurringExpenses(next.recurringExpenses);
    repository.savePlannedExpenses(next.plannedExpenses);
    repository.savePlannedIncomes(next.plannedIncomes);
    repository.saveBudgets(next.budgets);
    repository.saveImportBatches(next.importBatches);
    repository.saveMerchantRules(next.merchantRules);
    repository.saveExchangeRates(next.exchangeRates);
    // Older exports (before "이번 달 돈 배치") won't carry these two fields —
    // fall back to empty/default so an old JSON import doesn't crash the plan.
    const moneyPlans = next.moneyPlans ?? [];
    const moneyPlanBucketConfig = next.moneyPlanBucketConfig ?? DEFAULT_MONEY_PLAN_BUCKET_CONFIG;
    repository.saveMoneyPlans(moneyPlans);
    repository.saveMoneyPlanBucketConfig(moneyPlanBucketConfig);
    if (typeof window !== "undefined") window.localStorage.setItem(INIT_FLAG_KEY, "true");
    setData({ ...next, moneyPlans, moneyPlanBucketConfig });
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      loading,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      bulkAddTransactions,
      addRecurringExpense,
      updateRecurringExpense,
      deleteRecurringExpense,
      addPlannedExpense,
      updatePlannedExpense,
      deletePlannedExpense,
      addPlannedIncome,
      updatePlannedIncome,
      deletePlannedIncome,
      addCategory,
      updateCategory,
      deleteCategory,
      upsertMerchantRule,
      deleteMerchantRule,
      addBudget,
      updateBudget,
      deleteBudget,
      updateSettings,
      updateBudgets,
      updateExchangeRate,
      upsertMoneyPlan,
      updateMoneyPlanBucketConfig,
      clearDemoData,
      resetAllData,
      seedDemoData,
      replaceAllData,
    }),
    [
      data,
      loading,
      addAccount,
      updateAccount,
      deleteAccount,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      bulkAddTransactions,
      addRecurringExpense,
      updateRecurringExpense,
      deleteRecurringExpense,
      addPlannedExpense,
      updatePlannedExpense,
      deletePlannedExpense,
      addPlannedIncome,
      updatePlannedIncome,
      deletePlannedIncome,
      addCategory,
      updateCategory,
      deleteCategory,
      upsertMerchantRule,
      deleteMerchantRule,
      addBudget,
      updateBudget,
      deleteBudget,
      updateSettings,
      updateBudgets,
      updateExchangeRate,
      upsertMoneyPlan,
      updateMoneyPlanBucketConfig,
      clearDemoData,
      resetAllData,
      seedDemoData,
      replaceAllData,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within a DataProvider");
  return ctx;
}
