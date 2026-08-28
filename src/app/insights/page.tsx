"use client";

import { useMemo, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { MonthSelector } from "@/components/home/MonthSelector";
import { MonthSummaryRow } from "@/components/home/MonthSummaryRow";
import { CategoryBreakdownCard } from "@/components/home/CategoryBreakdownCard";
import { ComparisonList } from "@/components/insights/ComparisonList";
import { BiggestTransactionsList } from "@/components/insights/BiggestTransactionsList";
import { calculateBiggestTransactions, calculateCategoryBreakdown, calculateMonthOverMonth } from "@/lib/calculations";
import { generateInsightSentence } from "@/lib/insightSentence";

export default function InsightsPage() {
  const { data } = useData();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { transactions, categories, settings, exchangeRates } = data;
  const baseCurrency = settings.baseCurrency;

  const mom = useMemo(
    () => calculateMonthOverMonth(transactions, categories, selectedMonth, baseCurrency, exchangeRates),
    [transactions, categories, selectedMonth, baseCurrency, exchangeRates]
  );
  const categoryBreakdown = useMemo(
    () => calculateCategoryBreakdown(transactions, categories, selectedMonth, baseCurrency, exchangeRates),
    [transactions, categories, selectedMonth, baseCurrency, exchangeRates]
  );
  const biggestTransactions = useMemo(
    () => calculateBiggestTransactions(transactions, selectedMonth, baseCurrency, exchangeRates, 5),
    [transactions, selectedMonth, baseCurrency, exchangeRates]
  );
  const sentence = useMemo(() => generateInsightSentence(mom, baseCurrency), [mom, baseCurrency]);

  return (
    <div className="flex flex-col gap-4 pt-6">
      <h1 className="px-5 text-[20px] font-semibold tracking-tight text-ink">분석</h1>
      <MonthSelector month={selectedMonth} onChange={setSelectedMonth} />

      <div className="mx-5 flex items-start gap-3 rounded-2xl bg-accent-soft px-4 py-3.5 text-[14px] text-ink">
        <Lightbulb size={18} className="mt-0.5 shrink-0 text-accent" />
        <p>{sentence}</p>
      </div>

      <MonthSummaryRow income={mom.income} expense={mom.expense} net={mom.net} currency={baseCurrency} />

      <ComparisonList
        income={mom.income}
        expense={mom.expense}
        incomeChangePercent={mom.incomeChangePercent}
        expenseChangePercent={mom.expenseChangePercent}
        incomeChangeMinor={mom.incomeChangeMinor}
        expenseChangeMinor={mom.expenseChangeMinor}
        categoryDeltas={mom.categoryDeltas}
        currency={baseCurrency}
      />

      <CategoryBreakdownCard items={categoryBreakdown} currency={baseCurrency} />

      <BiggestTransactionsList items={biggestTransactions} currency={baseCurrency} />
    </div>
  );
}
