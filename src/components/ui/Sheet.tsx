"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_0.15s_ease-out]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface border border-border shadow-2xl",
          "animate-[slideUp_0.2s_ease-out]",
          className
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between bg-surface/95 backdrop-blur px-5 py-4 border-b border-border">
          <h2 className="text-[17px] font-semibold text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-5 safe-bottom">{children}</div>
      </div>
      <style jsx global>{`
        @keyframes slideUp {
          from {
            transform: translateY(24px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
