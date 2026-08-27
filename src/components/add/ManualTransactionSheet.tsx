"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import type { CurrencyCode, Transaction, TransactionType } from "@/types";

const TYPE_LABELS: Record<TransactionType, string> = {
  EXPENSE: "Expense",
  INCOME: "Income",
  TRANSFER: "Transfer",
  EXCHANGE: "Exchange",
  REFUND: "Refund",
  CASH_WITHDRAWAL: "Cash Withdrawal",
};

export function ManualTransactionSheet() {
  const { mode, close, editingTransactionId } = useAddFlow();
  const { data } = useData();
  const open = mode === "manual";
  const editing = editingTransactionId ? data.transactions.find((t) => t.id === editingTransactionId) : null;

  return (
    <Sheet open={open} onClose={close} title={editing ? "Edit Transaction" : "Add Transaction"}>
      {open && <ManualTransactionForm key={editingTransactionId ?? "new"} editing={editing ?? null} onDone={close} />}
    </Sheet>
  );
}

function ManualTransactionForm({ editing, onDone }: { editing: Transaction | null; onDone: () => void }) {
  const { data, addTransaction, updateTransaction, deleteTransaction, upsertMerchantRule } = useData();

  const [amount, setAmount] = useState(editing ? String(toMajorUnits(editing.amountMinor, editing.currency)) : "");
  const [merchant, setMerchant] = useState(editing?.merchant ?? "");
  const [type, setType] = useState<TransactionType>(editing?.transactionType ?? "EXPENSE");
  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? data.settings.baseCurrency);
  const [categoryId, setCategoryId] = useState(editing?.categoryId ?? "");
  const [subcategory, setSubcategory] = useState(editing?.subcategory ?? "");
  const [accountId, setAccountId] = useState(editing?.accountId ?? data.accounts[0]?.id ?? "");
  const [date, setDate] = useState(editing?.date ?? format(new Date(), "yyyy-MM-dd"));
  const [memo, setMemo] = useState(editing?.memo ?? "");

  const topLevelCategories = useMemo(() => data.categories.filter((c) => !c.parentId), [data.categories]);
  const subcategories = useMemo(
    () => data.categories.filter((c) => c.parentId === categoryId),
    [data.categories, categoryId]
  );

  const canSave = amount.trim() !== "" && merchant.trim() !== "" && categoryId !== "" && !isNaN(Number(amount));

  function handleSave() {
    if (!canSave) return;
    const amountMinor = toMinorUnits(Number(amount), currency);
    const payload = {
      date,
      merchant: merchant.trim(),
      amountMinor,
      currency,
      transactionType: type,
      categoryId: categoryId || null,
      subcategory: subcategory || null,
      accountId: accountId || null,
      memo,
      source: "MANUAL" as const,
      importBatchId: null,
      aiConfidence: null,
      reviewed: true,
      originalFileRef: null,
    };
    if (editing) {
      updateTransaction(editing.id, payload);
    } else {
      addTransaction(payload);
    }
    if (categoryId) {
      upsertMerchantRule(merchant, categoryId, subcategory || null);
    }
    onDone();
  }

  function handleDelete() {
    if (editing) deleteTransaction(editing.id);
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(TYPE_LABELS) as TransactionType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-xl border px-2 py-2 text-[12.5px] font-medium transition-colors ${
              type === t
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-ink-muted hover:bg-surface-muted"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <Label>Amount *</Label>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </div>
        <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)} className="w-24">
          <option value="AUD">AUD</option>
          <option value="KRW">KRW</option>
        </Select>
      </div>

      <div>
        <Label>Merchant *</Label>
        <Input placeholder="e.g. Woolworths" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </div>

      <div>
        <Label>Category *</Label>
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSubcategory("");
          }}
        >
          <option value="">Select category</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {subcategories.length > 0 && (
        <div>
          <Label>Subcategory</Label>
          <Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="">None</option>
            {subcategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-medium text-accent">More details (optional)</summary>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          <div>
            <Label>Memo</Label>
            <Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
      </details>

      <div className="mt-2 flex gap-2">
        {editing && (
          <Button variant="destructive" onClick={handleDelete} type="button">
            Delete
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "Save Changes" : "Add Transaction"}
        </Button>
      </div>
    </div>
  );
}
