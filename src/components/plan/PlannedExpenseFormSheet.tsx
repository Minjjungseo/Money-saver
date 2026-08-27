"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import type { CurrencyCode, PlannedExpense, PlannedExpenseStatus } from "@/types";

export function PlannedExpenseFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: PlannedExpense | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Edit Planned Expense" : "Add Planned Expense"}>
      {open && <PlannedExpenseForm key={editing?.id ?? "new"} editing={editing} onDone={onClose} />}
    </Sheet>
  );
}

function PlannedExpenseForm({ editing, onDone }: { editing: PlannedExpense | null; onDone: () => void }) {
  const { data, addPlannedExpense, updatePlannedExpense, deletePlannedExpense } = useData();

  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(toMajorUnits(editing.expectedAmountMinor, editing.currency)) : "");
  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? data.settings.baseCurrency);
  const [date, setDate] = useState(editing?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [essential, setEssential] = useState(editing?.essential ?? false);
  const [status, setStatus] = useState<PlannedExpenseStatus>(editing?.status ?? "PLANNED");
  const [accountId, setAccountId] = useState(editing?.accountId ?? data.accounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");

  const canSave = name.trim() !== "" && amount.trim() !== "" && !isNaN(Number(amount)) && date !== "";

  function handleSave() {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      expectedAmountMinor: toMinorUnits(Number(amount), currency),
      currency,
      date,
      essential,
      status,
      accountId: accountId || null,
      categoryId: categoryId || null,
    };
    if (editing) {
      updatePlannedExpense(editing.id, payload);
    } else {
      addPlannedExpense(payload);
    }
    onDone();
  }

  const topLevelCategories = data.categories.filter((c) => !c.parentId);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>Name *</Label>
        <Input placeholder="e.g. Sydney trip" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div>
          <Label>Expected amount *</Label>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="w-24">
          <option value="AUD">AUD</option>
          <option value="KRW">KRW</option>
        </Select>
      </div>
      <div>
        <Label>Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">None</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={status} onChange={(e) => setStatus(e.target.value as PlannedExpenseStatus)}>
          <option value="PLANNED">Planned</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>
      <div>
        <Label>Account</Label>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">None</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3">
        <div>
          <span className="text-[14px] text-ink">Essential</span>
          <p className="text-[12px] text-ink-muted">Counted in Available to Spend</p>
        </div>
        <input
          type="checkbox"
          checked={essential}
          onChange={(e) => setEssential(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
      </label>
      <div className="mt-2 flex gap-2">
        {editing && (
          <Button
            variant="destructive"
            onClick={() => {
              deletePlannedExpense(editing.id);
              onDone();
            }}
            type="button"
          >
            Delete
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "Save Changes" : "Add Planned Expense"}
        </Button>
      </div>
    </div>
  );
}
