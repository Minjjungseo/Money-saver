"use client";

import { Trash2 } from "lucide-react";
import { useData } from "@/lib/context/DataContext";

export function MerchantRulesManager() {
  const { data, deleteMerchantRule } = useData();
  const categoryById = new Map(data.categories.map((c) => [c.id, c]));

  if (data.merchantRules.length === 0) {
    return <p className="px-1 text-[13px] text-ink-muted">No learned rules yet. They build up as you correct categories.</p>;
  }

  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      {data.merchantRules.map((rule) => (
        <div key={rule.id} className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-ink">{rule.merchantPattern}</p>
            <p className="text-[12px] text-ink-muted">
              → {[categoryById.get(rule.categoryId)?.name, rule.subcategory].filter(Boolean).join(" · ")} · used {rule.confidence}x
            </p>
          </div>
          <button onClick={() => deleteMerchantRule(rule.id)} className="text-ink-faint hover:text-negative">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
