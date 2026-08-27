"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, isSameMonth } from "date-fns";

export function MonthSelector({
  month,
  onChange,
}: {
  month: Date;
  onChange: (next: Date) => void;
}) {
  const isCurrent = isSameMonth(month, new Date());
  return (
    <div className="flex items-center justify-center gap-4 py-1">
      <button
        onClick={() => onChange(addMonths(month, -1))}
        aria-label="Previous month"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="min-w-[9rem] text-center text-[15px] font-medium text-ink">
        {format(month, "MMMM yyyy")}
        {!isCurrent && (
          <button
            onClick={() => onChange(new Date())}
            className="ml-2 align-middle text-[11px] font-medium text-accent"
          >
            Today
          </button>
        )}
      </span>
      <button
        onClick={() => onChange(addMonths(month, 1))}
        aria-label="Next month"
        className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
