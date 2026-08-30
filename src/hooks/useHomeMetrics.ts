"use client";

import { useMemo } from "react";
import { useData } from "@/lib/context/DataContext";
import {
  calculateAllAccountsTotal,
  calculateAvailableToSpend,
  calculateAvailableToSpendReadiness,
  calculateExpenseTotals,
  calculateCategoryBreakdown,
  calculateDailyAvailable,
  calculateFixedCostSummary,
  calculateLivingSpendByBucket,
  calculateMonthlyExpense,
  calculateMonthlyIncome,
  calculateMonthlyTrend,
  calculateThisWeekAvailable,
  calculateUpcomingItems,
  calculateWeeklyAvailable,
  calculateWeeklyBudgetUsage,
  daysSinceLatestTransaction,
  getHorizonRange,
  getLatestTransactionDate,
} from "@/lib/calculations";

export function useHomeMetrics(selectedMonth: Date, now: Date = new Date()) {
  const { data } = useData();
  const { accounts, transactions, categories, recurringExpenses, plannedExpenses, plannedIncomes, budgets, settings, exchangeRates } = data;
  const baseCurrency = settings.baseCurrency;

  return useMemo(() => {
    const income = calculateMonthlyIncome(transactions, selectedMonth, baseCurrency, exchangeRates);
    const expense = calculateMonthlyExpense(transactions, selectedMonth, baseCurrency, exchangeRates);
    const net = income - expense;

    const trend = calculateMonthlyTrend(transactions, selectedMonth, baseCurrency, exchangeRates, 5);
    const categoryBreakdown = calculateCategoryBreakdown(transactions, categories, selectedMonth, baseCurrency, exchangeRates);

    const availableToSpend = calculateAvailableToSpend({
      accounts,
      recurringExpenses,
      plannedExpenses,
      plannedIncomes,
      reserveMinor: settings.reserveMinor,
      reserveCurrency: settings.reserveCurrency,
      baseCurrency,
      rates: exchangeRates,
      referenceDate: now,
      horizon: settings.availableHorizon,
    });

    const { start: horizonStart, end: horizonEnd } = getHorizonRange(now, settings.availableHorizon);
    const upcomingItems = calculateUpcomingItems(recurringExpenses, plannedExpenses, horizonStart, horizonEnd);

    const readiness = calculateAvailableToSpendReadiness({
      accounts,
      recurringExpenses,
      plannedExpenses,
      plannedIncomes,
      settings,
    });

    const weeklyBudget = calculateWeeklyBudgetUsage(transactions, budgets, now, baseCurrency, exchangeRates);

    const fixedCostSummary = calculateFixedCostSummary(recurringExpenses, budgets, baseCurrency, exchangeRates);
    const expenseTotals = calculateExpenseTotals(transactions, categories, selectedMonth, baseCurrency, exchangeRates);
    const livingSpendByBucket = calculateLivingSpendByBucket(transactions, categories, selectedMonth, baseCurrency, exchangeRates);
    const accountBalanceTotal = calculateAllAccountsTotal(accounts, baseCurrency, exchangeRates);

    const monthlyLivingBudgetMinor = fixedCostSummary.monthlyBudgetMinor;
    const fixedBudgetMinor = fixedCostSummary.includedTotalBaseMinor;
    const variableBudgetMinor = monthlyLivingBudgetMinor === null ? 0 : monthlyLivingBudgetMinor - fixedBudgetMinor;
    const livingUsedMinor = expenseTotals.householdFixedMinor + expenseTotals.householdVariableMinor;
    // Prefer the new living-budget remaining once a monthly budget is set, so
    // the "이번 주/이번 달 남은 생활비" pacing figures agree with the hero card
    // above instead of the old full-balance-based Available-to-Spend total.
    const livingRemainingMinor = monthlyLivingBudgetMinor === null ? null : monthlyLivingBudgetMinor - livingUsedMinor;
    const pacingBaseMinor = livingRemainingMinor ?? availableToSpend.availableToSpend;

    const latestTransactionDate = getLatestTransactionDate(transactions);
    const daysBehind = daysSinceLatestTransaction(transactions, now) ?? 0;

    const dailyAvailable = calculateDailyAvailable(pacingBaseMinor, now);
    const weeklyAvailable = calculateWeeklyAvailable(pacingBaseMinor, now);
    const thisWeekAvailable = calculateThisWeekAvailable(pacingBaseMinor, now);

    return {
      baseCurrency,
      income,
      expense,
      net,
      trend,
      categoryBreakdown,
      availableToSpend,
      readiness,
      weeklyBudget,
      fixedCostSummary,
      expenseTotals,
      livingSpendByBucket,
      accountBalanceTotal,
      monthlyLivingBudgetMinor,
      fixedBudgetMinor,
      variableBudgetMinor,
      livingUsedMinor,
      latestTransactionDate,
      daysBehind,
      upcomingItems,
      dailyAvailable,
      weeklyAvailable,
      thisWeekAvailable,
      livingRemainingMinor,
      monthRemainingSpending: pacingBaseMinor,
    };
  }, [
    accounts,
    transactions,
    categories,
    recurringExpenses,
    plannedExpenses,
    plannedIncomes,
    budgets,
    settings,
    exchangeRates,
    baseCurrency,
    selectedMonth,
    now,
  ]);
}
