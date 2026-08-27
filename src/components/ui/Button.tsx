import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap",
  {
    variants: {
      variant: {
        primary: "bg-ink text-background hover:opacity-90",
        accent: "bg-accent text-white hover:opacity-90",
        secondary: "bg-surface-muted text-ink hover:bg-border",
        outline: "border border-border bg-transparent text-ink hover:bg-surface-muted",
        ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-surface-muted",
        destructive: "bg-negative text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-13 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
