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
          setErrors(["This doesn't look like a Money OS export file."]);
        } else {
          setJsonData(parsed as AppData);
          setErrors([]);
        }
      } catch {
        setErrors(["Couldn't read that file as JSON."]);
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
    <Sheet open={open} onClose={handleClose} title="Import Data">
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
          <OptionButton icon={FileSpreadsheet} title="Transactions CSV" description="date, merchant, amount, currency, transaction_type, category, subcategory, account, memo" onClick={() => pick("TX_CSV")} />
          <OptionButton icon={Wallet} title="Accounts CSV" description="name, bank, currency, balance, type, include_in_available" onClick={() => pick("ACCOUNTS_CSV")} />
          <OptionButton icon={FileJson} title="Full backup (JSON)" description="Restores everything from a Money OS export. This replaces your current data." onClick={() => pick("JSON")} />
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          {errors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-negative-soft px-3.5 py-3 text-[13px] text-negative">
              <div className="flex items-center gap-1.5 font-medium">
                <TriangleAlert size={14} /> {errors.length} issue{errors.length === 1 ? "" : "s"} found
              </div>
              {errors.slice(0, 5).map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {kind === "TX_CSV" && (
            <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[14px] text-ink">
              <p>{txRows.length} transaction{txRows.length === 1 ? "" : "s"} ready to import.</p>
              {dupCount > 0 && <p className="mt-1 text-ink-muted">{dupCount} possible duplicate{dupCount === 1 ? "" : "s"} will be skipped.</p>}
            </div>
          )}
          {kind === "ACCOUNTS_CSV" && (
            <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[14px] text-ink">
              <p>{accountRows.length} account{accountRows.length === 1 ? "" : "s"} ready to import.</p>
            </div>
          )}
          {kind === "JSON" && jsonData && (
            <div className="rounded-xl bg-warn-soft px-3.5 py-3 text-[14px] text-warn">
              <p className="font-medium">This will replace all current data.</p>
              <p className="mt-1">
                {jsonData.accounts.length} accounts, {jsonData.transactions.length} transactions, and everything else
                from this file.
              </p>
            </div>
          )}

          <Button
            variant="accent"
            size="lg"
            disabled={kind === "TX_CSV" ? txRows.length === 0 : kind === "ACCOUNTS_CSV" ? accountRows.length === 0 : !jsonData}
            onClick={confirmImport}
          >
            Confirm Import
          </Button>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check size={26} />
          </div>
          <p className="text-[15px] font-medium text-ink">Imported {importedCount} item{importedCount === 1 ? "" : "s"}</p>
          <Button variant="secondary" onClick={handleClose}>
            Done
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
