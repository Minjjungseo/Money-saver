"use client";

import { useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { Camera, Check, Loader2, TriangleAlert } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { useData } from "@/lib/context/DataContext";
import { parseTransactionImage } from "@/services/transactionImageParser";
import { formatMoney, toMajorUnits, toMinorUnits } from "@/lib/money";
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import type { CurrencyCode, ParsedTransactionCandidate, TransactionType } from "@/types";

type Step = "upload" | "parsing" | "review" | "done";

interface EditableCandidate extends ParsedTransactionCandidate {
  included: boolean;
  editing: boolean;
}

export function ImageImportFlow() {
  const { mode, close } = useAddFlow();
  const { data, bulkAddTransactions, upsertMerchantRule } = useData();
  const open = mode === "image";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [provider, setProvider] = useState<"claude-vision" | "mock" | null>(null);
  const [candidates, setCandidates] = useState<EditableCandidate[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  function reset() {
    setStep("upload");
    setPreviewUrl(null);
    setFileName(null);
    setProvider(null);
    setCandidates([]);
  }

  function handleClose() {
    reset();
    close();
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
    setStep("parsing");

    const base64 = await fileToBase64(file);
    const result = await parseTransactionImage(base64, file.type || "image/jpeg", {
      categories: data.categories,
      merchantRules: data.merchantRules,
      accounts: data.accounts,
      existingTransactions: data.transactions,
    });

    setProvider(result.provider);
    setCandidates(result.candidates.map((c) => ({ ...c, included: !c.possibleDuplicateOfId, editing: false })));
    setStep("review");
  }

  function updateCandidate(id: string, patch: Partial<EditableCandidate>) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function handleConfirmImport() {
    const toImport = candidates.filter((c) => c.included);
    if (toImport.length === 0) {
      handleClose();
      return;
    }

    bulkAddTransactions(
      toImport.map((c) => ({
        date: c.date,
        merchant: c.merchant,
        amountMinor: c.amountMinor,
        currency: c.currency,
        transactionType: c.transactionType,
        categoryId: c.suggestedCategoryId,
        subcategory: c.suggestedSubcategory,
        accountId: c.suggestedAccountId,
        memo: "",
        source: "IMAGE_IMPORT",
        importBatchId: null,
        aiConfidence: c.confidence,
        reviewed: true,
        originalFileRef: fileName,
        transferAccountId: null,
      })),
      { source: "IMAGE_IMPORT", fileRef: fileName }
    );

    for (const c of toImport) {
      if (c.suggestedCategoryId) {
        upsertMerchantRule(c.merchant, c.suggestedCategoryId, c.suggestedSubcategory);
      }
    }

    setImportedCount(toImport.length);
    setStep("done");
  }

  const includedCount = useMemo(() => candidates.filter((c) => c.included).length, [candidates]);

  return (
    <Sheet open={open} onClose={handleClose} title={step === "review" ? "인식된 내역 확인" : "이미지로 추가"}>
      {step === "upload" && (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Camera size={28} />
          </div>
          <p className="text-[14px] text-ink-muted max-w-xs">
            은행 앱 스크린샷, 거래내역, 영수증을 올려주세요. 저장 전에 내용을 확인할 수 있게 보여드릴게요.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <Button variant="accent" size="lg" onClick={() => fileInputRef.current?.click()}>
            이미지 올리기
          </Button>
        </div>
      )}

      {step === "parsing" && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          {previewUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={previewUrl} alt="업로드한 이미지" className="h-32 w-32 rounded-2xl object-cover border border-border" />
          )}
          <Loader2 size={24} className="animate-spin text-accent" />
          <p className="text-[14px] text-ink-muted">이미지에서 거래내역을 읽고 있어요…</p>
        </div>
      )}

      {step === "review" && (
        <div className="flex flex-col gap-4">
          {provider === "mock" && (
            <div className="flex items-start gap-2 rounded-xl bg-warn-soft px-3.5 py-3 text-[13px] text-warn">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                이미지 인식 API가 설정되지 않아 예시 항목을 보여드리고 있어요. 실제 이미지 내용에 맞게 직접
                수정해주시거나, ANTHROPIC_API_KEY를 설정하면 실제 이미지 인식이 켜져요.
              </span>
            </div>
          )}
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-muted">이미지에서 인식된 내용이 없어요.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {candidates.map((c) => (
                <CandidateRow
                  key={c.id}
                  candidate={c}
                  duplicateTx={c.possibleDuplicateOfId ? data.transactions.find((t) => t.id === c.possibleDuplicateOfId) : undefined}
                  categories={data.categories}
                  accounts={data.accounts}
                  onChange={(patch) => updateCandidate(c.id, patch)}
                />
              ))}
            </div>
          )}
          <Button variant="accent" size="lg" disabled={includedCount === 0} onClick={handleConfirmImport}>
            내역에 추가 ({includedCount})
          </Button>
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Check size={26} />
          </div>
          <p className="text-[15px] font-medium text-ink">거래 {importedCount}건을 추가했어요</p>
          <Button variant="secondary" onClick={handleClose}>
            완료
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function CandidateRow({
  candidate,
  duplicateTx,
  categories,
  accounts,
  onChange,
}: {
  candidate: EditableCandidate;
  duplicateTx?: { merchant: string; date: string };
  categories: import("@/types").Category[];
  accounts: import("@/types").Account[];
  onChange: (patch: Partial<EditableCandidate>) => void;
}) {
  const topLevelCategories = categories.filter((c) => !c.parentId);
  const categoryName = categories.find((cat) => cat.id === candidate.suggestedCategoryId)?.name;

  return (
    <div className={`rounded-2xl border p-3.5 ${candidate.included ? "border-border bg-surface" : "border-border bg-surface-muted opacity-60"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={candidate.included}
          onChange={(e) => onChange({ included: e.target.checked })}
          className="mt-1 h-5 w-5 shrink-0 accent-accent"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-ink-muted">{format(parseISO(candidate.date), "M월 d일", { locale: ko })}</p>
            <Badge tone={candidate.confidence >= 80 ? "accent" : "warn"}>인식 정확도 {candidate.confidence}%</Badge>
          </div>
          <p className="text-[15px] font-medium text-ink">{candidate.merchant}</p>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-ink-muted">
              {[categoryName, candidate.suggestedSubcategory].filter(Boolean).join(" · ") || "카테고리 없음"}
            </p>
            <p className="text-[14px] font-medium tabular-nums text-ink">
              {formatMoney(candidate.amountMinor, candidate.currency)}
            </p>
          </div>

          {duplicateTx && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-negative-soft px-2.5 py-1.5 text-[12px] text-negative">
              <TriangleAlert size={13} />
              &quot;{duplicateTx.merchant}&quot; ({format(parseISO(duplicateTx.date), "M월 d일", { locale: ko })})와 중복 가능성
            </div>
          )}

          <button
            onClick={() => onChange({ editing: !candidate.editing })}
            className="mt-2 text-[13px] font-medium text-accent"
          >
            {candidate.editing ? "숨기기" : "수정"}
          </button>

          {candidate.editing && (
            <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
              <div>
                <Label>사용처</Label>
                <Input value={candidate.merchant} onChange={(e) => onChange({ merchant: e.target.value })} />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <Label>금액</Label>
                  <Input
                    inputMode="decimal"
                    value={String(toMajorUnits(candidate.amountMinor, candidate.currency))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!isNaN(n)) onChange({ amountMinor: toMinorUnits(n, candidate.currency) });
                    }}
                  />
                </div>
                <Select
                  className="w-24"
                  value={candidate.currency}
                  onChange={(e) => onChange({ currency: e.target.value as CurrencyCode })}
                >
                  <option value="AUD">AUD</option>
                  <option value="KRW">KRW</option>
                </Select>
              </div>
              <div>
                <Label>날짜</Label>
                <Input type="date" value={candidate.date} onChange={(e) => onChange({ date: e.target.value })} />
              </div>
              <div>
                <Label>거래 유형</Label>
                <Select
                  value={candidate.transactionType}
                  onChange={(e) => onChange({ transactionType: e.target.value as TransactionType })}
                >
                  {(Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]).map((t) => (
                    <option key={t} value={t}>
                      {TRANSACTION_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>카테고리</Label>
                <Select
                  value={candidate.suggestedCategoryId ?? ""}
                  onChange={(e) => onChange({ suggestedCategoryId: e.target.value || null })}
                >
                  <option value="">카테고리 없음</option>
                  {topLevelCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>계좌</Label>
                <Select
                  value={candidate.suggestedAccountId ?? ""}
                  onChange={(e) => onChange({ suggestedAccountId: e.target.value || null })}
                >
                  <option value="">없음</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
