"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { MonthlyTrendPoint } from "@/lib/calculations/cashflow";
import { formatMoney } from "@/lib/money";
import type { CurrencyCode } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function TrendChart({
  trend,
  currency,
  selectedMonthKey,
  onSelectMonth,
}: {
  trend: MonthlyTrendPoint[];
  currency: CurrencyCode;
  selectedMonthKey: string;
  onSelectMonth: (monthKey: string) => void;
}) {
  return (
    <Card className="mx-5">
      <CardHeader>
        <CardTitle>Monthly Income vs Expense</CardTitle>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={trend}
              margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
              barGap={3}
              onClick={(state) => {
                const label = state?.activeLabel;
                const point = trend.find((p) => p.label === label);
                if (point) onSelectMonth(point.monthKey);
              }}
            >
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--ink-faint)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--surface-muted)" }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(value, name) => [
                  formatMoney(Number(value), currency),
                  name === "income" ? "Income" : "Expense",
                ]}
              />
              <Bar dataKey="income" radius={[4, 4, 0, 0]} maxBarSize={18} fill="var(--accent)">
                {trend.map((p) => (
                  <Cell key={p.monthKey} fillOpacity={p.monthKey === selectedMonthKey ? 1 : 0.55} />
                ))}
              </Bar>
              <Bar dataKey="expense" radius={[4, 4, 0, 0]} maxBarSize={18} fill="var(--negative)">
                {trend.map((p) => (
                  <Cell
                    key={p.monthKey}
                    fillOpacity={p.monthKey === selectedMonthKey ? 0.85 : 0.4}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[12px] text-ink-muted">
          <Legend swatch="var(--accent)" label="Income" />
          <Legend swatch="var(--negative)" label="Expense" />
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: swatch }} />
      {label}
    </span>
  );
}
