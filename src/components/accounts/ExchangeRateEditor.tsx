"use client";

import { useState } from "react";
import { Pencil, Check } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { getAudKrwRate } from "@/lib/exchange";

export function ExchangeRateEditor() {
  const { data, updateExchangeRate } = useData();
  const [editing, setEditing] = useState(false);
  const rate = getAudKrwRate(data.exchangeRates);
  const [value, setValue] = useState(String(rate));

  function save() {
    const parsed = Number(value);
    if (!isNaN(parsed) && parsed > 0) {
      updateExchangeRate("AUD_KRW", parsed);
    }
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3.5 py-2.5 text-[13px]">
      <span className="text-ink-muted">1 AUD =</span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            inputMode="decimal"
            className="w-24 rounded-lg border border-border bg-surface px-2 py-1 text-right tabular-nums outline-none focus:border-accent"
          />
          <span className="text-ink-muted">KRW</span>
          <button onClick={save} className="text-accent">
            <Check size={16} />
          </button>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 font-medium text-ink">
          {rate.toLocaleString()} KRW
          <Pencil size={12} className="text-ink-faint" />
        </button>
      )}
    </div>
  );
}
