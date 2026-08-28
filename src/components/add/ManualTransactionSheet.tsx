"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import type { CurrencyCode, Transaction, TransactionType } from "@/types";

export function ManualTransactionSheet() {
  const { mode, close, editingTransactionId } = useAddFlow();
  const { data } = useData();
  const open = mode === "manual";
  const editing = editingTransactionId ? data.transactions.find((t) => t.id === editingTransactionId) : null;

  return (
    <Sheet open={open} onClose={close} title={editing ? "거래 수정" : "거래 추가"}>
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
        {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-xl border px-2 py-2 text-[12.5px] font-medium transition-colors ${
              type === t
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-ink-muted hover:bg-surface-muted"
            }`}
          >
            {TRANSACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <Label>금액 *</Label>
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
        <Label>사용처 *</Label>
        <Input placeholder="예: Woolworths" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </div>

      <div>
        <Label>카테고리 *</Label>
        <Select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSubcategory("");
          }}
        >
          <option value="">카테고리 선택</option>
          {topLevelCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {subcategories.length > 0 && (
        <div>
          <Label>세부 카테고리</Label>
          <Select value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            <option value="">없음</option>
            {subcategories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer list-none text-sm font-medium text-accent">자세히 입력 (선택)</summary>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <Label>날짜</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>계좌</Label>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">없음</option>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>메모</Label>
            <Textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
      </details>

      <div className="mt-2 flex gap-2">
        {editing && (
          <Button variant="destructive" onClick={handleDelete} type="button">
            삭제
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "저장" : "거래 추가"}
        </Button>
      </div>
    </div>
  );
}
