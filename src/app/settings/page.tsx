"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Upload } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { ExchangeRateEditor } from "@/components/accounts/ExchangeRateEditor";
import { ReserveCard } from "@/components/plan/ReserveCard";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { MerchantRulesManager } from "@/components/settings/MerchantRulesManager";
import { downloadTextFile } from "@/lib/download";
import { accountsToCsv, transactionsToCsv } from "@/lib/csv";
import type { CurrencyCode } from "@/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-5 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      <div className="px-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { data, updateSettings, clearDemoData, resetAllData } = useData();
  const { openImport } = useAddFlow();
  const [confirmingReset, setConfirmingReset] = useState(false);

  function handleExportJson() {
    downloadTextFile("money-os-export.json", JSON.stringify(data, null, 2), "application/json");
  }
  function handleExportTransactionsCsv() {
    downloadTextFile("money-os-transactions.csv", transactionsToCsv(data.transactions, data.categories, data.accounts), "text/csv");
  }
  function handleExportAccountsCsv() {
    downloadTextFile("money-os-accounts.csv", accountsToCsv(data.accounts), "text/csv");
  }

  function handleReset() {
    if (!confirmingReset) {
      setConfirmingReset(true);
      return;
    }
    resetAllData();
    setConfirmingReset(false);
  }

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex items-center gap-2 px-5">
        <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted">
          <ChevronLeft size={19} />
        </Link>
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Settings</h1>
      </div>

      <Section title="General">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3.5 py-2.5">
            <span className="text-[13px] text-ink-muted">Base currency</span>
            <Select
              value={data.settings.baseCurrency}
              onChange={(e) => updateSettings({ baseCurrency: e.target.value as CurrencyCode })}
              className="h-8 w-28"
            >
              <option value="AUD">AUD</option>
              <option value="KRW">KRW</option>
            </Select>
          </div>
          <ExchangeRateEditor />
        </div>
      </Section>

      <Section title="Reserve">
        <ReserveCard />
      </Section>

      <Section title="Categories">
        <CategoryManager />
      </Section>

      <Section title="Merchant Rules">
        <MerchantRulesManager />
      </Section>

      <Section title="Data">
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={handleExportJson}>
            <Download size={15} /> Export all data (JSON)
          </Button>
          <Button variant="outline" onClick={handleExportTransactionsCsv}>
            <Download size={15} /> Export transactions (CSV)
          </Button>
          <Button variant="outline" onClick={handleExportAccountsCsv}>
            <Download size={15} /> Export accounts (CSV)
          </Button>
          <Button variant="outline" onClick={openImport}>
            <Upload size={15} /> Import data
          </Button>
        </div>
      </Section>

      <Section title="Demo Data">
        <div className="flex flex-col gap-2">
          {data.settings.demoDataActive && (
            <Button variant="outline" onClick={clearDemoData}>
              Clear Demo Data
            </Button>
          )}
          <Button variant={confirmingReset ? "destructive" : "outline"} onClick={handleReset}>
            {confirmingReset ? "Tap again to confirm — this deletes everything" : "Reset All Data"}
          </Button>
          {confirmingReset && (
            <button onClick={() => setConfirmingReset(false)} className="text-[13px] text-ink-muted">
              Cancel
            </button>
          )}
        </div>
      </Section>

      <p className="px-5 pb-6 text-center text-[12px] text-ink-faint">Money OS · your data stays on this device</p>
    </div>
  );
}
