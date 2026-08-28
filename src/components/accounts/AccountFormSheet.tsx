"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { useData } from "@/lib/context/DataContext";
import { toMinorUnits, toMajorUnits } from "@/lib/money";
import { ACCOUNT_TYPE_LABELS } from "@/lib/labels";
import type { Account, AccountType, CurrencyCode } from "@/types";

export function AccountFormSheet({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Account | null;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={editing ? "계좌 수정" : "계좌 추가"}>
      {open && <AccountForm key={editing?.id ?? "new"} editing={editing} onDone={onClose} />}
    </Sheet>
  );
}

function AccountForm({ editing, onDone }: { editing: Account | null; onDone: () => void }) {
  const { addAccount, updateAccount, deleteAccount } = useData();

  const [name, setName] = useState(editing?.name ?? "");
  const [bank, setBank] = useState(editing?.bank ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(editing?.currency ?? "AUD");
  const [balance, setBalance] = useState(editing ? String(toMajorUnits(editing.balanceMinor, editing.currency)) : "");
  const [type, setType] = useState<AccountType>(editing?.type ?? "CHECKING");
  const [includeInAvailable, setIncludeInAvailable] = useState(editing?.includeInAvailable ?? true);

  const canSave = name.trim() !== "" && balance.trim() !== "" && !isNaN(Number(balance));

  function handleSave() {
    if (!canSave) return;
    const payload = {
      name: name.trim(),
      bank: bank.trim(),
      currency,
      balanceMinor: toMinorUnits(Number(balance), currency),
      type,
      includeInAvailable,
    };
    if (editing) {
      updateAccount(editing.id, payload);
    } else {
      addAccount(payload);
    }
    onDone();
  }

  function handleDelete() {
    if (editing) deleteAccount(editing.id);
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label>계좌 이름 *</Label>
        <Input placeholder="예: 생활비 통장" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <Label>은행</Label>
        <Input placeholder="예: Commonwealth Bank" value={bank} onChange={(e) => setBank(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>통화</Label>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
            <option value="AUD">AUD</option>
            <option value="KRW">KRW</option>
          </Select>
        </div>
        <div>
          <Label>현재 잔고 *</Label>
          <Input inputMode="decimal" placeholder="0.00" value={balance} onChange={(e) => setBalance(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>계좌 종류</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
          {(Object.keys(ACCOUNT_TYPE_LABELS) as AccountType[]).map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>
      <label className="flex items-center justify-between rounded-xl border border-border px-3.5 py-3">
        <span className="text-[14px] text-ink">사용 가능 금액 계산에 포함</span>
        <input
          type="checkbox"
          checked={includeInAvailable}
          onChange={(e) => setIncludeInAvailable(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
      </label>

      <div className="mt-2 flex gap-2">
        {editing && (
          <Button variant="destructive" onClick={handleDelete} type="button">
            삭제
          </Button>
        )}
        <Button variant="accent" size="lg" className="flex-1" disabled={!canSave} onClick={handleSave}>
          {editing ? "저장" : "계좌 추가"}
        </Button>
      </div>
    </div>
  );
}
