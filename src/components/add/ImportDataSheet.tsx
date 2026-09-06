"use client";

import { useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FileJson, Wallet, TriangleAlert, Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { useData } from "@/lib/context/DataContext";
import { parseAccountsCsv, parseTransactionsCsv, type ParseTransactionsCsvResult, type TransactionCsvRow } from "@/lib/csv";
import { matchCategoryByName } from "@/lib/merchantRules";
import { findPossibleDuplicate } from "@/lib/duplicateDetection";
import { formatMoney } from "@/lib/money";
import type { Account, AppData, CurrencyCode } from "@/types";

type ImportKind = "TX_CSV" | "ACCOUNTS_CSV" | "JSON";
type Step = "choose" | "preview" | "done";

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
  /**
   * Per-row account assignment, index-aligned with txResult.rows — never a
   * single value applied to the whole file, since a real bank/card export
   * can mix accounts (e.g. CommBank and 하나트래블로그 transactions in one
   * CSV). Pre-filled from the row's own account column when the file has
   * one; null means "not chosen yet", which blocks that row from importing.
   */
  const [rowAccountIds, setRowAccountIds] = useState<(string | null)[]>([]);
  const [accountRows, setAccountRows] = useState<ReturnType<typeof parseAccountsCsv>["rows"]>([]);
  const [accountErrors, setAccountErrors] = useState<string[]>([]);
  const [jsonData, setJsonData] = useState<AppData | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);

  function reset() {
    setStep("choose");
    setKind(null);
    setTxResult(null);
    setRowAccountIds([]);
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
      // The file's own account column (when present) pre-fills each row;
      // a row whose name doesn't match any real account, or a file with no
      // account column at all, starts unassigned — never guessed.
      setRowAccountIds(
        result.rows.map((row) => {
          if (!row.accountName) return null;
          const match = data.accounts.find((a) => a.name.toLowerCase() === row.accountName.toLowerCase());
          return match?.id ?? null;
        })
      );
      setStep("preview");
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

  function setRowAccount(index: number, accountId: string | null) {
    setRowAccountIds((prev) => prev.map((id, i) => (i === index ? accountId : id)));
  }

  function applyAccountToAll(accountId: string) {
    setRowAccountIds((prev) => prev.map(() => accountId));
  }

  // For each parsed row: its assigned account (or none yet), resolved
  // category, and — only once an account is actually assigned — whether it
  // duplicates an existing transaction. A row with no account yet is never
  // marked new or duplicate; it's simply "계좌 선택 필요" until resolved.
  const previewRows = useMemo(() => {
    if (!txResult) return [];
    return txResult.rows.map((row, i) => {
      const accountId = rowAccountIds[i] ?? null;
      const account = accountId ? data.accounts.find((a) => a.id === accountId) ?? null : null;
      const categoryId = matchCategoryByName(row.categoryName, data.categories);
      const category = categoryId ? data.categories.find((c) => c.id === categoryId) : null;
      const duplicateOf = account
        ? findPossibleDuplicate(
            { date: row.date, amountMinor: row.amountMinor, merchant: row.merchant, accountId: account.id, currency: row.currency },
            data.transactions
          )
        : null;
      return { row, account, categoryId, categoryName: category?.name ?? null, duplicateOf };
    });
  }, [txResult, rowAccountIds, data.accounts, data.categories, data.transactions]);

  const needsAccountRows = previewRows.filter((r) => !r.account);
  const dupRows = previewRows.filter((r) => r.account && r.duplicateOf);
  const importableRows = previewRows.filter((r) => r.account && !r.duplicateOf);
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
      importableRows.map(({ row, account, categoryId }) => ({
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
    setImportedCount(importableRows.length);
    setImportedDupCount(dupRows.length);
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

      {step === "preview" && kind === "TX_CSV" && txResult && (
        <div className="flex flex-col gap-4">
          <ErrorSummary result={txResult} />

          {!txResult.hasAccountColumn && data.accounts.length > 0 && (
            <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
              <p className="text-[13px] font-medium text-ink">전체 계좌 지정</p>
              <p className="mt-0.5 text-[12px] text-ink-faint">
                이 파일엔 계좌 컬럼이 없어요. 먼저 전체에 하나를 적용한 뒤, 아래에서 계좌가 다른 거래만 따로 바꿔주세요.
              </p>
              <Select
                value=""
                onChange={(e) => e.target.value && applyAccountToAll(e.target.value)}
                className="mt-2 h-9 text-[13px]"
              >
                <option value="">전체를 적용할 계좌 선택…</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    전체를 {a.name}(으)로 설정
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[14px] text-ink">
            <p className="font-medium">
              {previewRows.length}건 · 총{" "}
              {[...totalsByCurrency.entries()].map(([cur, minor]) => formatMoney(minor, cur)).join(" + ") || "0"}
            </p>
            <p className="mt-1 text-ink-muted">
              Import 가능 {importableRows.length}건
              {needsAccountRows.length > 0 && ` · 계좌 확인 필요 ${needsAccountRows.length}건`}
              {dupRows.length > 0 && ` · 이미 등록됨 ${dupRows.length}건`}
            </p>
          </div>

          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {previewRows.map(({ row, account, categoryName, duplicateOf }, i) => (
              <PreviewRow
                key={i}
                row={row}
                accounts={data.accounts}
                accountId={rowAccountIds[i] ?? null}
                onAccountChange={(id) => setRowAccount(i, id)}
                categoryName={categoryName}
                isDuplicate={!!account && !!duplicateOf}
              />
            ))}
          </div>

          <Button variant="accent" size="lg" disabled={importableRows.length === 0} onClick={confirmTxImport}>
            {importableRows.length}건 불러오기 확정
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
  accounts,
  accountId,
  onAccountChange,
  categoryName,
  isDuplicate,
}: {
  row: TransactionCsvRow;
  accounts: Account[];
  accountId: string | null;
  onAccountChange: (accountId: string | null) => void;
  categoryName: string | null;
  isDuplicate: boolean;
}) {
  const status = !accountId ? "계좌 선택 필요" : isDuplicate ? "이미 등록됨" : "추가 예정";
  const statusColor = !accountId ? "text-warn" : isDuplicate ? "text-ink-faint" : "text-accent";

  return (
    <div className="flex flex-col gap-2 px-3.5 py-2.5 text-[13px]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.merchant}</p>
          <p className="truncate text-[12px] text-ink-faint">
            {row.date}
            {row.time ? ` ${row.time}` : ""} · {categoryName ?? (row.categoryName || "미분류")}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-medium tabular-nums text-ink">{formatMoney(row.amountMinor, row.currency)}</p>
          <p className={`text-[11px] font-medium ${statusColor}`}>{status}</p>
        </div>
      </div>
      <Select
        value={accountId ?? ""}
        onChange={(e) => onAccountChange(e.target.value || null)}
        className={`h-8 text-[12px] ${!accountId ? "border-warn" : ""}`}
      >
        <option value="">계좌 선택 필요</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name} ({a.currency})
          </option>
        ))}
      </Select>
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
