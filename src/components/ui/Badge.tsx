import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

const toneClasses = {
  neutral: "bg-surface-muted text-ink-muted",
  accent: "bg-accent-soft text-accent",
  negative: "bg-negative-soft text-negative",
  warn: "bg-warn-soft text-warn",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof toneClasses }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
