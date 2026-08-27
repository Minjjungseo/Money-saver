"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import type { CurrencyCode, PlannedIncome } from "@/types";

export function PlannedIncomeFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: PlannedIncome | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit Planned Income" : "Add Planned Income"}>
      {open && <PlannedIncomeForm key={editing?.id ?? "new"} editing={editing} onDone={onClose} />}
    </Sheet>
  );
}

function PlannedIncomeForm({ editing, onDone }: { editing: PlannedIncome | null; onDone: () => void }) {
  const { data, addPlannedIncome, updatePlannedIncome, deletePlannedIncome } = useData();

  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(toMajorUnits(editing.amountMinor, editing.currency)) : "");
  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? data.settings.baseCurrency);
  const [expectedDate, setExpectedDate] = useState(editing?.expectedDate ?? format(new Date(), "yyyy-MM-dd"));
  const [confirmed, setConfirmed] = useState(editing?.confirmed ?? true);
  const [source, setSource] = useState(editing?.source ?? "");

  const canSave = name.trim() !== "" && amount.trim() !== "" && !isNaN(Number(amount)) && expectedDate !== "";

  function handleSave() {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      amountMinor: toMinorUnits(Number(amount), currency),
      currency,
      expectedDate,
      confirmed,
      source: source.trim(),
    };
    if (editing) {
      updatePlannedIncome(editing.id, payload);
    } else {
      addPlannedIncome(payload);
    }
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Name *</Label>
        <Input placeholder="e.g. Salary" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <Label>Amount *</Label>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="w-24">
          <option value="AUD">AUD</option>
          <option value="KRW">KRW</option>
        </Select>
      </div>
      <div>
        <Label>Expected date</Label>
        <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
      </div>
      <div>
        <Label>Source</Label>
        <Input placeholder="e.g. Employer" value={source} onChange={(e) => setSource(e.target.value)} />
      </div>
      <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3">
        <div>
          <span className="text-[14px] text-ink">Confirmed</span>
          <p className="text-[12px] text-ink-muted">Only confirmed income counts toward Available to Spend</p>
        </div>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
      </label>
      <div className="mt-2 flex gap-2">
        {editing && (
          <Button
            variant="destructive"
            onClick={() => {
              deletePlannedIncome(editing.id);
              onDone();
            }}
            type="button"
          >
            Delete
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "Save Changes" : "Add Planned Income"}
        </Button>
      </div>
    </div>
  );
}
