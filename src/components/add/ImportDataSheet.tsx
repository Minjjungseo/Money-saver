"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, FileJson, Wallet, TriangleAlert, Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { useData } from "@/lib/context/DataContext";
import { parseAccountsCsv, parseTransactionsCsv } from "@/lib/csv";
import { matchCategoryByName } from "@/lib/merchantRules";
import { findPossibleDuplicate } from "@/lib/duplicateDetection";
import type { AppData } from "@/types";

type ImportKind = "TX_CSV" | "ACCOUNTS_CSV" | "JSON";
type Step = "choose" | "preview" | "done";

export function ImportDataSheet() {
  const { mode, close } = useAddFlow();
  const { data, bulkAddTransactions, addAccount, replaceAllData } = useData();
  const open = mode === "import";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("choose");
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const [txRows, setTxRows] = useState<ReturnType<typeof parseTransactionsCsv>["rows"]>([]);
  const [dupCount, setDupCount] = useState(0);
  const [accountRows, setAccountRows] = useState<ReturnType<typeof parseAccountsCsv>["rows"]>([]);
  const [jsonData, setJsonData] = useState<AppData | null>(null);

  function reset() {
    setStep("choose");
    setKind(null);
    setErrors([]);
    setTxRows([]);
    setAccountRows([]);
    setJsonData(null);
    setDupCount(0);
  }

  function handleClose() {
    reset();
    close();
  }

  function pick(k: ImportKind) {
    setKind(k);
    fileInputRef.current?.click();
  }

  async function handleFile(file: File) {
    const text = await file.text();

    if (kind === "TX_CSV") {
      const { rows, errors } = parseTransactionsCsv(text);
      const dupes = rows.filter((r) =>
        findPossibleDuplicate({ date: r.date, amountMinor: r.amountMinor, merchant: r.merchant, accountId: null }, data.transactions)
      ).length;
      setTxRows(rows);
      setDupCount(dupes);
      setErrors(errors);
      setStep("preview");
    } else if (kind === "ACCOUNTS_CSV") {
      const { rows, errors } = parseAccountsCsv(text);
      setAccountRows(rows);
      setErrors(errors);
      setStep("preview");
    } else if (kind === "JSON") {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) {
          setErrors(["Money OS에서 내보낸 파일이 아닌 것 같아요."]);
        } else {
          setJsonData(parsed as AppData);
          setErrors([]);
        }
      } catch {
        setErrors(["JSON 파일을 읽을 수 없어요."]);
      }
      setStep("preview");
    }
  }

  function confirmImport() {
    if (kind === "TX_CSV") {
      const skippingDuplicates = txRows.filter(
        (r) => !findPossibleDuplicate({ date: r.date, amountMinor: r.amountMinor, merchant: r.merchant, accountId: null }, data.transactions)
      );
      bulkAddTransactions(
        skippingDuplicates.map((r) => {
          const account = data.accounts.find((a) => a.name.toLowerCase() === r.accountName.toLowerCase());
          const categoryId = matchCategoryByName(r.categoryName, data.categories);
          return {
            date: r.date,
            merchant: r.merchant,
            amountMinor: r.amountMinor,
            currency: r.currency,
            transactionType: r.transactionType,
            categoryId,
            subcategory: r.subcategory || null,
            accountId: account?.id ?? null,
            memo: r.memo,
            sourceClassification: r.sourceClassification || null,
            sourceNature: r.sourceNature || null,
            sourceFixedVariable: r.sourceFixedVariable || null,
            source: "CSV_IMPORT",
            importBatchId: null,
            aiConfidence: null,
            reviewed: true,
            originalFileRef: null,
            transferAccountId: null,
          };
        }),
        { source: "CSV_IMPORT", fileRef: null }
      );
      setImportedCount(skippingDuplicates.length);
    } else if (kind === "ACCOUNTS_CSV") {
      for (const r of accountRows) {
        addAccount({
          name: r.name,
          bank: r.bank,
          currency: r.currency,
          balanceMinor: r.balanceMinor,
          balanceAsOfDate: r.balanceAsOfDate,
          type: r.type,
          includeInAvailable: r.includeInAvailable,
        });
      }
      setImportedCount(accountRows.length);
    } else if (kind === "JSON" && jsonData) {
      replaceAllData(jsonData);
      setImportedCount(jsonData.transactions.length + jsonData.accounts.length);
    }
    setStep("done");
  }

  return (
    <Sheet open={open} onClose={handleClose} title="파일 불러오기">
      <input
        ref={fileInputRef}
        type="file"
        accept={kind === "JSON" ? "application/json" : ".csv,text/csv"}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {step === "choose" && (
        <div className="flex flex-col gap-2">
          <OptionButton
            icon={FileSpreadsheet}
            title="거래 내역 CSV"
            description="date, merchant, amount, currency, transaction_type, category, subcategory, account, memo"
            onClick={() => pick("TX_CSV")}
          />
          <OptionButton
            icon={Wallet}
            title="계좌 CSV"
            description="name, bank, currency, balance, type, include_in_available"
            onClick={() => pick("ACCOUNTS_CSV")}
          />
          <OptionButton
            icon={FileJson}
            title="전체 백업 (JSON)"
            description="Money OS에서 내보낸 파일로 모든 데이터를 복원해요. 현재 데이터는 모두 대체돼요."
            onClick={() => pick("JSON")}
          />
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-negative-soft px-3.5 py-3 text-[13px] text-negative">
              <div className="flex items-center gap-1.5 font-medium">
                <TriangleAlert size={14} /> 문제 {errors.length}건 발견
              </div>
              {errors.slice(0, 5).map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {kind === "TX_CSV" && (
            <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[14px] text-ink">
              <p>거래 {txRows.length}건을 불러올 수 있어요.</p>
              {dupCount > 0 && <p className="mt-1 text-ink-muted">중복 가능성이 있는 {dupCount}건은 건너뛸게요.</p>}
            </div>
          )}
          {kind === "ACCOUNTS_CSV" && (
            <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[14px] text-ink">
              <p>계좌 {accountRows.length}개를 불러올 수 있어요.</p>
            </div>
          )}
          {kind === "JSON" && jsonData && (
            <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[14px] text-warn">
              <p className="font-medium">현재 데이터가 모두 대체돼요.</p>
              <p className="mt-1">
                계좌 {jsonData.accounts.length}개, 거래 {jsonData.transactions.length}건을 포함해 이 파일의 모든 데이터로
                대체돼요.
              </p>
            </div>
          )}

          <Button
            variant="accent"
            size="lg"
            disabled={kind === "TX_CSV" ? txRows.length === 0 : kind === "ACCOUNTS_CSV" ? accountRows.length === 0 : !jsonData}
            onClick={confirmImport}
          >
            불러오기 확정
          </Button>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check size={26} />
          </div>
          <p className="text-[15px] font-medium text-ink">{importedCount}건을 불러왔어요</p>
          <Button variant="secondary" onClick={handleClose}>
            완료
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function OptionButton({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof FileSpreadsheet;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3.5 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-muted"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-[15px] font-medium text-ink">{title}</p>
        <p className="text-[13px] text-ink-muted">{description}</p>
      </div>
    </button>
  );
}
