"use client";

import { useMemo } from "react";
import { useData } from "@/lib/context/DataContext";
import {
  calculateAvailableToSpend,
  calculateCategoryBreakdown,
  calculateDailyAvailable,
  calculateMonthlyExpense,
  calculateMonthlyIncome,
  calculateMonthlyTrend,
  calculateThisWeekAvailable,
  calculateUpcomingItems,
  calculateWeeklyAvailable,
  getHorizonRange,
} from "@/lib/calculations";

export function useHomeMetrics(selectedMonth: Date, now: Date = new Date()) {
  const { data } = useData();
  const { accounts, transactions, categories, recurringExpenses, plannedExpenses, plannedIncomes, settings, exchangeRates } = data;
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

    const dailyAvailable = calculateDailyAvailable(availableToSpend.availableToSpend, now);
    const weeklyAvailable = calculateWeeklyAvailable(availableToSpend.availableToSpend, now);
    const thisWeekAvailable = calculateThisWeekAvailable(availableToSpend.availableToSpend, now);

    return {
      baseCurrency,
      income,
      expense,
      net,
      trend,
      categoryBreakdown,
      availableToSpend,
      upcomingItems,
      dailyAvailable,
      weeklyAvailable,
      thisWeekAvailable,
      monthRemainingSpending: availableToSpend.availableToSpend,
    };
  }, [
    accounts,
    transactions,
    categories,
    recurringExpenses,
    plannedExpenses,
    plannedIncomes,
    settings,
    exchangeRates,
    baseCurrency,
    selectedMonth,
    now,
  ]);
}
