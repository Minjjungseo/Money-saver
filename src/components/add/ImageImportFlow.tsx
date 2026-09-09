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

/** A row is ready to import only once date/merchant/amount are all actually filled in — computed live so fixing a gap in the edit form immediately unblocks it. */
function isComplete(c: ParsedTransactionCandidate): boolean {
  return c.date !== null && c.merchant !== null && c.merchant.trim() !== "" && c.amountMinor !== null;
}

function canInclude(c: ParsedTransactionCandidate): boolean {
  return isComplete(c) && !c.pending && !c.possibleDuplicateOfId;
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
    setCandidates(result.candidates.map((c) => ({ ...c, included: canInclude(c), editing: false })));
    setStep("review");
  }

  function updateCandidate(id: string, patch: Partial<EditableCandidate>) {
    setCandidates((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const next = { ...c, ...patch };
        // Editing a row can turn an incomplete/pending row into an importable
        // one (or vice versa) — keep `included` in sync with what's actually
        // allowed rather than trusting whatever it was set to before the edit.
        return { ...next, included: next.included && canInclude(next) };
      })
    );
  }

  function handleConfirmImport() {
    const toImport = candidates.filter((c) => c.included && canInclude(c));
    if (toImport.length === 0) {
      handleClose();
      return;
    }

    bulkAddTransactions(
      toImport.map((c) => ({
        date: c.date!,
        merchant: c.merchant!,
        amountMinor: c.amountMinor!,
        currency: c.currency,
        transactionType: c.transactionType,
        categoryId: c.suggestedCategoryId,
        subcategory: c.suggestedSubcategory,
        accountId: c.suggestedAccountId,
        memo: c.time ? `${c.time}` : "",
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
      if (c.suggestedCategoryId && c.merchant) {
        upsertMerchantRule(c.merchant, c.suggestedCategoryId, c.suggestedSubcategory);
      }
    }

    setImportedCount(toImport.length);
    setStep("done");
  }

  const includedCount = useMemo(() => candidates.filter((c) => c.included).length, [candidates]);
  const detectedCount = candidates.length;
  const cleanCount = candidates.filter((c) => isComplete(c)).length;
  const needsReviewCount = candidates.filter((c) => !isComplete(c)).length;
  const importableCount = candidates.filter((c) => canInclude(c)).length;

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
          {previewUrl && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="업로드한 이미지"
                className="max-h-56 w-auto rounded-2xl border border-border object-contain"
              />
            </div>
          )}

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
            <>
              <div className="rounded-xl bg-surface-muted px-3.5 py-3 text-[13px] text-ink">
                <p>화면에서 감지한 거래 블록 {detectedCount}건</p>
                <p className="mt-0.5 text-ink-muted">
                  정상 추출 {cleanCount}건 · 확인 필요 {needsReviewCount}건 · Import 가능 {importableCount}건
                </p>
              </div>
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
            </>
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
  const complete = isComplete(candidate);
  const selectable = canInclude(candidate);
  const dateLabel = candidate.date ? format(parseISO(candidate.date), "M월 d일", { locale: ko }) : "날짜 확인 필요";

  return (
    <div className={`rounded-2xl border p-3.5 ${candidate.included ? "border-border bg-surface" : "border-border bg-surface-muted opacity-80"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={candidate.included}
          disabled={!selectable}
          onChange={(e) => onChange({ included: e.target.checked })}
          className="mt-1 h-5 w-5 shrink-0 accent-accent disabled:opacity-40"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] text-ink-muted">
              {dateLabel}
              {candidate.time && ` · ${candidate.time}`}
            </p>
            <div className="flex items-center gap-1">
              {candidate.pending && <Badge tone="warn">정산 대기(PENDING)</Badge>}
              {duplicateTx && <Badge tone="neutral">이미 등록됨</Badge>}
              {!complete && !candidate.pending && !duplicateTx && <Badge tone="warn">확인 필요</Badge>}
              {complete && !candidate.pending && !duplicateTx && (
                <Badge tone={candidate.confidence >= 80 ? "accent" : "warn"}>인식 정확도 {candidate.confidence}%</Badge>
              )}
            </div>
          </div>
          <p className="text-[15px] font-medium text-ink">{candidate.merchant ?? "가맹점 확인 필요"}</p>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-ink-muted">
              {[categoryName, candidate.suggestedSubcategory].filter(Boolean).join(" · ") || "카테고리 없음"}
            </p>
            <p className="text-[14px] font-medium tabular-nums text-ink">
              {candidate.amountMinor !== null ? formatMoney(candidate.amountMinor, candidate.currency) : "금액 확인 필요"}
            </p>
          </div>

          {candidate.reviewReason && !complete && (
            <p className="mt-1.5 text-[12px] text-warn">{candidate.reviewReason}</p>
          )}

          {candidate.pending && (
            <p className="mt-1.5 text-[12px] text-ink-muted">정산 전 거래는 확정 지출로 저장하지 않아요. 정산 후 다시 확인해주세요.</p>
          )}

          {duplicateTx && (
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-negative-soft px-2.5 py-1.5 text-[12px] text-negative">
              <TriangleAlert size={13} />
              &quot;{duplicateTx.merchant}&quot; ({format(parseISO(duplicateTx.date), "M월 d일", { locale: ko })})와 중복으로 보여 제외했어요.
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
                <Input
                  value={candidate.merchant ?? ""}
                  placeholder="가맹점 이름 입력"
                  onChange={(e) => onChange({ merchant: e.target.value.trim() || null })}
                />
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <Label>금액</Label>
                  <Input
                    inputMode="decimal"
                    placeholder="0.00"
                    value={candidate.amountMinor !== null ? String(toMajorUnits(candidate.amountMinor, candidate.currency)) : ""}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      onChange({ amountMinor: e.target.value.trim() !== "" && !isNaN(n) && n > 0 ? toMinorUnits(n, candidate.currency) : null });
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
                <Input
                  type="date"
                  value={candidate.date ?? ""}
                  onChange={(e) => onChange({ date: e.target.value || null })}
                />
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
