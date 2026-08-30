"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Upload } from "lucide-react";
import { useData } from "@/lib/context/DataContext";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { hasDemoData } from "@/lib/demoData";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { ExchangeRateEditor } from "@/components/accounts/ExchangeRateEditor";
import { ReserveCard } from "@/components/plan/ReserveCard";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { MerchantRulesManager } from "@/components/settings/MerchantRulesManager";
import { BudgetManager } from "@/components/settings/BudgetManager";
import { downloadTextFile } from "@/lib/download";
import { accountsToCsv, transactionsToCsv } from "@/lib/csv";
import type { CurrencyCode } from "@/types";
import { MigrationStatusCard } from "@/components/settings/MigrationStatusCard";

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
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">설정</h1>
      </div>

      <Section title="일반">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between rounded-xl bg-surface-muted px-3.5 py-2.5">
            <span className="text-[13px] text-ink-muted">기준 통화</span>
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

      <Section title="남겨둘 돈">
        <ReserveCard />
      </Section>

      <Section title="예산">
        <BudgetManager />
      </Section>

      <Section title="카테고리">
        <CategoryManager />
      </Section>

      <Section title="가맹점 규칙">
        <MerchantRulesManager />
      </Section>

      <Section title="데이터">
        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={handleExportJson}>
            <Download size={15} /> 전체 데이터 내보내기 (JSON)
          </Button>
          <Button variant="outline" onClick={handleExportTransactionsCsv}>
            <Download size={15} /> 거래 내역 내보내기 (CSV)
          </Button>
          <Button variant="outline" onClick={handleExportAccountsCsv}>
            <Download size={15} /> 계좌 내보내기 (CSV)
          </Button>
          <Button variant="outline" onClick={openImport}>
            <Upload size={15} /> 데이터 불러오기
          </Button>
        </div>
      </Section>

      <Section title="예시 데이터">
        <div className="flex flex-col gap-2">
          {hasDemoData(data) && (
            <Button variant="outline" onClick={clearDemoData}>
              예시 데이터 지우기
            </Button>
          )}
          <Button variant={confirmingReset ? "destructive" : "outline"} onClick={handleReset}>
            {confirmingReset ? "다시 누르면 모든 데이터가 삭제돼요" : "전체 데이터 초기화"}
          </Button>
          {confirmingReset && (
            <button onClick={() => setConfirmingReset(false)} className="text-[13px] text-ink-muted">
              취소
            </button>
          )}
        </div>
      </Section>

      <Section title="마이그레이션 상태">
        <MigrationStatusCard />
      </Section>

      <p className="px-5 pb-6 text-center text-[12px] text-ink-faint">Money OS · 모든 데이터는 이 기기에만 저장돼요</p>
    </div>
  );
}
