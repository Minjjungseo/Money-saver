import { cn } from '@/lib/utils'

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label={label}>
        {options.map(([k, v]) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            aria-pressed={value === k}
            className={cn('rounded-md px-2.5 py-1 text-sm text-muted-foreground', value === k && 'bg-card font-medium text-primary shadow-sm')}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  )
}
