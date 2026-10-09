import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap', {
  variants: {
    variant: {
      default: 'bg-muted text-slate-700',
      primary: 'bg-accent text-primary',
      sample: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300',
      warn: 'bg-orange-50 text-orange-800 ring-1 ring-orange-200',
      outline: 'ring-1 ring-border text-muted-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...p} />
}
