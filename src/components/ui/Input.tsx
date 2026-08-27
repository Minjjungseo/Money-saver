import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-faint outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors",
          className
        )}
        {...props}
      />
    );
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-[15px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("block text-[13px] font-medium text-ink-muted mb-1.5", className)}
      {...props}
    />
  );
}
