"use client";

import { useState } from "react";
import { Wallet, Plus } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { AccountCard } from "@/components/accounts/AccountCard";
import { AccountFormSheet } from "@/components/accounts/AccountFormSheet";
import { ExchangeRateEditor } from "@/components/accounts/ExchangeRateEditor";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { calculateAllAccountsTotal } from "@/lib/calculations";
import { formatMoney } from "@/lib/money";
import type { Account } from "@/types";

export default function AccountsPage() {
  const { data } = useData();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const total = calculateAllAccountsTotal(data.accounts, data.settings.baseCurrency, data.exchangeRates);
  const hasMixedCurrencies = data.accounts.some((a) => a.currency !== data.settings.baseCurrency);

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between px-5">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Accounts</h1>
        <Button size="sm" variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus size={16} /> Add
        </Button>
      </div>

      <div className="mt-4 px-5">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Total balance</p>
        <p className="mt-1 text-[32px] font-semibold tabular-nums text-ink">
          {formatMoney(total, data.settings.baseCurrency)}
        </p>
        {hasMixedCurrencies && (
          <div className="mt-3">
            <ExchangeRateEditor />
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 px-5">
        {data.accounts.length === 0 ? (
          <EmptyState
            icon={<Wallet size={28} />}
            title="No accounts yet"
            description="Add a bank account, savings account, or cash to start tracking your balance."
            action={
              <Button variant="accent" onClick={() => { setEditing(null); setFormOpen(true); }}>
                Add an account
              </Button>
            }
          />
        ) : (
          data.accounts.map((a) => (
            <AccountCard key={a.id} account={a} onClick={() => { setEditing(a); setFormOpen(true); }} />
          ))
        )}
      </div>

      <AccountFormSheet open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </div>
  );
}
