"use client";

import { useState } from "react";
import { Pencil, Check, ShieldCheck } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits, formatMoney } from "@/lib/money";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export function ReserveCard() {
  const { data, updateSettings } = useData();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(toMajorUnits(data.settings.reserveMinor, data.settings.reserveCurrency)));

  function save() {
    const parsed = Number(value);
    if (!isNaN(parsed) && parsed >= 0) {
      updateSettings({ reserveMinor: toMinorUnits(parsed, data.settings.reserveCurrency), reserveConfirmed: true });
    }
    setEditing(false);
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldCheck size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[13px] font-medium text-ink-muted">남겨둘 돈</p>
              {!data.settings.reserveConfirmed && <Badge tone="warn">설정 필요</Badge>}
            </div>
            <p className="text-[12px] text-ink-faint">절대 쓰지 않을 금액</p>
          </div>
        </div>
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
            <button onClick={save} className="text-accent">
              <Check size={18} />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <span className="text-[16px] font-semibold tabular-nums text-ink">
              {formatMoney(data.settings.reserveMinor, data.settings.reserveCurrency)}
            </span>
            <Pencil size={13} className="text-ink-faint" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
