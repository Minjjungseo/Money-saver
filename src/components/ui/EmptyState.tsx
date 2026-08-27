import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      {icon && <div className="text-ink-faint">{icon}</div>}
      <div className="space-y-1">
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {description && <p className="text-sm text-ink-muted max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  );
}
