"use client";

import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileJson, Wallet, TriangleAlert, Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { useData } from "@/lib/context/DataContext";
import { parseAccountsCsv, parseTransactionsCsv, type ParseTransactionsCsvResult, type TransactionCsvRow } from "@/lib/csv";
import { matchCategoryByName } from "@/lib/merchantRules";
import { findPossibleDuplicate } from "@/lib/duplicateDetection";
import { formatMoney } from "@/lib/money";
import type { AppData, CurrencyCode } from "@/types";

type ImportKind = "TX_CSV" | "ACCOUNTS_CSV" | "JSON";
type Step = "choose" | "select-account" | "preview" | "done";

export function ImportDataSheet() {
  const { mode, close } = useAddFlow();
  const { data, bulkAddTransactions, addAccount, replaceAllData } = useData();
  const open = mode === "import";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("choose");
  const [kind, setKind] = useState<ImportKind | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [importedDupCount, setImportedDupCount] = useState(0);

  const [txResult, setTxResult] = useState<ParseTransactionsCsvResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountRows, setAccountRows] = useState<ReturnType<typeof parseAccountsCsv>["rows"]>([]);
  const [accountErrors, setAccountErrors] = useState<string[]>([]);
  const [jsonData, setJsonData] = useState<AppData | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  function reset() {
    setStep("choose");
    setKind(null);
    setTxResult(null);
    setSelectedAccountId(null);
    setAccountRows([]);
    setAccountErrors([]);
    setJsonData(null);
    setJsonError(null);
    setImportedCount(0);
    setImportedDupCount(0);
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
      const result = parseTransactionsCsv(text);
      setTxResult(result);
      setStep(result.hasAccountColumn ? "preview" : "select-account");
    } else if (kind === "ACCOUNTS_CSV") {
      const { rows, errors } = parseAccountsCsv(text);
      setAccountRows(rows);
      setAccountErrors(errors);
      setStep("preview");
    } else if (kind === "JSON") {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.transactions) || !Array.isArray(parsed.accounts)) {
          setJsonError("Money OS에서 내보낸 파일이 아닌 것 같아요.");
        } else {
          setJsonData(parsed as AppData);
          setJsonError(null);
        }
      } catch {
        setJsonError("JSON 파일을 읽을 수 없어요.");
      }
      setStep("preview");
    }
  }

  // For each parsed row, resolve its account (per-row column, or the single
  // account picked when the file had none) and whether it already exists.
  const previewRows = useMemo(() => {
    if (!txResult) return [];
    return txResult.rows.map((row) => {
      const account = row.accountName
        ? data.accounts.find((a) => a.name.toLowerCase() === row.accountName.toLowerCase())
        : data.accounts.find((a) => a.id === selectedAccountId);
      const categoryId = matchCategoryByName(row.categoryName, data.categories);
      const category = categoryId ? data.categories.find((c) => c.id === categoryId) : null;
      const duplicateOf = findPossibleDuplicate(
        { date: row.date, amountMinor: row.amountMinor, merchant: row.merchant, accountId: account?.id ?? null, currency: row.currency },
        data.transactions
      );
      return { row, account, categoryId, categoryName: category?.name ?? null, duplicateOf };
    });
  }, [txResult, data.accounts, data.categories, data.transactions, selectedAccountId]);

  const newRows = previewRows.filter((r) => !r.duplicateOf);
  const dupRowCount = previewRows.length - newRows.length;
  const totalsByCurrency = useMemo(() => {
    const totals = new Map<CurrencyCode, number>();
    for (const { row } of previewRows) {
      totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amountMinor);
    }
    return totals;
  }, [previewRows]);

  function confirmTxImport() {
    if (!txResult) return;
    bulkAddTransactions(
      newRows.map(({ row, account, categoryId }) => ({
        date: row.date,
        merchant: row.merchant,
        amountMinor: row.amountMinor,
        currency: row.currency,
        transactionType: row.transactionType,
        categoryId,
        subcategory: row.subcategory || null,
        accountId: account?.id ?? null,
        memo: row.memo,
        sourceClassification: row.sourceClassification || null,
        sourceNature: row.sourceNature || null,
        sourceFixedVariable: row.sourceFixedVariable || null,
        source: "CSV_IMPORT",
        importBatchId: null,
        aiConfidence: null,
        reviewed: true,
        originalFileRef: null,
        transferAccountId: null,
      })),
      { source: "CSV_IMPORT", fileRef: null }
    );
    setImportedCount(newRows.length);
    setImportedDupCount(dupRowCount);
    setStep("done");
  }

  function confirmAccountsImport() {
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
    setStep("done");
  }

  function confirmJsonImport() {
    if (!jsonData) return;
    replaceAllData(jsonData);
    setImportedCount(jsonData.transactions.length + jsonData.accounts.length);
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
          e.target.value = "";
        }}
      />

      {step === "choose" && (
        <div className="flex flex-col gap-2">
          <OptionButton
            icon={FileSpreadsheet}
            title="거래 내역 CSV"
            description="날짜/거래일, 가맹점/사용처, 금액, 통화, 분류, 계좌, 메모 등 흔한 header 이름을 자동으로 인식해요."
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

      {step === "select-account" && txResult && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] text-warn">
            이 파일에는 계좌를 나타내는 컬럼이 없어요. 이 {txResult.rows.length}건이 어느 계좌에서 결제됐는지 선택해 주세요.
          </div>
          {data.accounts.length === 0 ? (
            <p className="text-[13px] text-ink-muted">먼저 계좌를 하나 이상 등록해야 계좌를 선택할 수 있어요.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccountId(a.id)}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-[14px] font-medium transition-colors ${
                    selectedAccountId === a.id
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-surface text-ink hover:bg-surface-muted"
                  }`}
                >
                  {a.name}
                  <span className="text-[12px] font-normal text-ink-faint">{a.currency}</span>
                </button>
              ))}
            </div>
          )}
          <Button variant="accent" size="lg" disabled={!selectedAccountId} onClick={() => setStep("preview")}>
            선택한 계좌로 계속하기
          </Button>
        </div>
      )}

      {step === "preview" && kind === "TX_CSV" && txResult && (
        <div className="flex flex-col gap-4">
          <ErrorSummary result={txResult} />

          <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[14px] text-ink">
            <p className="font-medium">
              {previewRows.length}건 · 총{" "}
              {[...totalsByCurrency.entries()].map(([cur, minor]) => formatMoney(minor, cur)).join(" + ") || "0"}
            </p>
            {dupRowCount > 0 && <p className="mt-1 text-ink-muted">이미 등록된 것으로 보이는 {dupRowCount}건은 제외하고 불러와요.</p>}
          </div>

          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {previewRows.map(({ row, account, categoryName, duplicateOf }, i) => (
              <PreviewRow key={i} row={row} accountName={account?.name ?? null} categoryName={categoryName} isDuplicate={!!duplicateOf} />
            ))}
          </div>

          <Button variant="accent" size="lg" disabled={newRows.length === 0} onClick={confirmTxImport}>
            {newRows.length}건 불러오기 확정
          </Button>
        </div>
      )}

      {step === "preview" && kind === "ACCOUNTS_CSV" && (
        <div className="flex flex-col gap-4">
          {accountErrors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-negative-soft px-3.5 py-3 text-[13px] text-negative">
              <div className="flex items-center gap-1.5 font-medium">
                <TriangleAlert size={14} /> 문제 {accountErrors.length}건 발견
              </div>
              {accountErrors.slice(0, 5).map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[14px] text-ink">
            <p>계좌 {accountRows.length}개를 불러올 수 있어요.</p>
          </div>
          <Button variant="accent" size="lg" disabled={accountRows.length === 0} onClick={confirmAccountsImport}>
            불러오기 확정
          </Button>
        </div>
      )}

      {step === "preview" && kind === "JSON" && (
        <div className="flex flex-col gap-4">
          {jsonError && (
            <div className="flex items-center gap-1.5 rounded-xl bg-negative-soft px-3.5 py-3 text-[13px] font-medium text-negative">
              <TriangleAlert size={14} /> {jsonError}
            </div>
          )}
          {jsonData && (
            <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[14px] text-warn">
              <p className="font-medium">현재 데이터가 모두 대체돼요.</p>
              <p className="mt-1">
                계좌 {jsonData.accounts.length}개, 거래 {jsonData.transactions.length}건을 포함해 이 파일의 모든 데이터로
                대체돼요.
              </p>
            </div>
          )}
          <Button variant="accent" size="lg" disabled={!jsonData} onClick={confirmJsonImport}>
            불러오기 확정
          </Button>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check size={26} />
          </div>
          <p className="text-[15px] font-medium text-ink">{importedCount}건을 새로 불러왔어요</p>
          {importedDupCount > 0 && <p className="text-[13px] text-ink-muted">이미 등록된 {importedDupCount}건은 건너뛰었어요.</p>}
          <Button variant="secondary" onClick={handleClose}>
            완료
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function ErrorSummary({ result }: { result: ParseTransactionsCsvResult }) {
  if (result.errors.length === 0) return null;
  const okCount = result.rows.length;
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-negative-soft px-3.5 py-3 text-[13px] text-negative">
      <div className="flex items-center gap-1.5 font-medium">
        <TriangleAlert size={14} />
        정상 {okCount}건 · 확인 필요 {result.errors.length}건
      </div>
      {result.errors.slice(0, 5).map((e, i) => (
        <div key={i} className="rounded-lg bg-surface/60 px-2.5 py-2">
          <p className="font-medium">{e.line}번째 줄</p>
          <p>원본 header: {e.rawHeader}</p>
          <p>원본 값: {e.rawValue || "(비어 있음)"}</p>
          <p>매핑된 field: {e.mappedField}</p>
          <p>실패 이유: {e.reason}</p>
        </div>
      ))}
      {result.errors.length > 5 && <p>외 {result.errors.length - 5}건 더</p>}
    </div>
  );
}

function PreviewRow({
  row,
  accountName,
  categoryName,
  isDuplicate,
}: {
  row: TransactionCsvRow;
  accountName: string | null;
  categoryName: string | null;
  isDuplicate: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{row.merchant}</p>
        <p className="truncate text-[12px] text-ink-faint">
          {row.date}
          {row.time ? ` ${row.time}` : ""} · {categoryName ?? (row.categoryName || "미분류")} · {accountName ?? "계좌 미확인"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-medium tabular-nums text-ink">{formatMoney(row.amountMinor, row.currency)}</p>
        <p className={`text-[11px] font-medium ${isDuplicate ? "text-ink-faint" : "text-accent"}`}>
          {isDuplicate ? "이미 등록됨" : "추가 예정"}
        </p>
      </div>
    </div>
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
