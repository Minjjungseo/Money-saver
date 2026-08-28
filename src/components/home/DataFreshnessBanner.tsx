"use client";

import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useAddFlow } from "@/lib/context/AddFlowContext";

/**
 * Subtle nudge, not a warning — shown only when the newest transaction on
 * record is older than today, so the user knows the numbers above reflect
 * data up to that date rather than "right now".
 */
export function DataFreshnessBanner({ latestDate, daysBehind }: { latestDate: string; daysBehind: number }) {
  const { openMenu } = useAddFlow();
  if (daysBehind <= 0) return null;

  return (
    <div className="mx-5 flex items-center justify-between rounded-xl bg-surface-muted px-3.5 py-2.5 text-[12px] text-ink-faint">
      <span>
        최근 업데이트 {format(parseISO(latestDate), "M월 d일", { locale: ko })}
      </span>
      <button onClick={openMenu} className="font-medium text-accent">
        최근 내역 추가
      </button>
    </div>
  );
}
