"use client";

import { useData } from "@/lib/context/DataContext";
import { DATA_MIGRATION_TARGET_VERSION } from "@/lib/migrations/dataMigration";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-[13px] font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * Diagnostic-only readout of the one-time production data migration's last
 * run on THIS device — so a person can confirm on their own real phone that
 * it actually applied, rather than taking a developer's word for it. Every
 * number here comes straight from Settings.dataMigrationSummary / the live
 * store, never from a hardcoded target — if a figure looks wrong, that's
 * this device's real state, not a display bug.
 */
export function MigrationStatusCard() {
  const { data } = useData();
  const { settings, transactions, recurringExpenses } = data;
  const summary = settings.dataMigrationSummary;

  if (!settings.dataMigrationVersion || !summary) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-3.5 py-3">
        <p className="text-[13px] text-ink-muted">아직 마이그레이션이 실행되지 않았어요. (버전 0 / 목표 {DATA_MIGRATION_TARGET_VERSION})</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
      <Row label="마이그레이션 버전" value={`v${settings.dataMigrationVersion} / 목표 v${DATA_MIGRATION_TARGET_VERSION}`} />
      <Row label="상태" value={settings.dataMigrationVersion >= DATA_MIGRATION_TARGET_VERSION ? "완료" : "대기 중"} />
      <Row label="실행 시각" value={new Date(summary.ranAt).toLocaleString("ko-KR")} />
      <Row label="거래 건수" value={`${transactions.length}건`} />
      <Row label="매칭됨 / 캐노니컬" value={`${summary.matched} / ${summary.canonicalTotal}`} />
      <Row label="미매칭" value={`${summary.unmatched}건`} />
      <Row label="이번 실행에서 수정됨" value={`${summary.updated}건`} />
      <Row label="분류 완료" value={`${summary.categorizedCount}건`} />
      <Row label="미분류" value={`${summary.uncategorizedCount}건`} />
      <Row label="고정 거래" value={`${summary.fixedCount}건`} />
      <Row label="반복 지출 항목" value={`${recurringExpenses.length}개 (업서트 ${summary.recurringExpensesUpserted}개)`} />
      <Row label="생활비 예산" value={summary.budgetCreated ? "기본값 생성됨" : "기존 값 유지"} />
      <Row label="생성 / 삭제" value={`${summary.created} / ${summary.deleted}`} />
    </div>
  );
}
