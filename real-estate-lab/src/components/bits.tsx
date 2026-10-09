import type { ReactNode } from 'react'
import { AlertTriangle, ExternalLink, FlaskConical, Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDiff, formatPct } from '@/lib/money'
import { cn } from '@/lib/utils'
import { PRICE_TYPE_LABEL, type PriceRecord, type PriceType } from '@/store/schema'
import type { Change } from '@/lib/calc'

export function SampleBadge({ show = true }: { show?: boolean }) {
  if (!show) return null
  return (
    <Badge variant="sample" title="화면 테스트용 예시 데이터입니다. 실제 시세가 아닙니다.">
      <FlaskConical className="size-3" />
      예시 데이터
    </Badge>
  )
}

export function PriceTypeBadge({ type }: { type: PriceType }) {
  return <Badge variant={type === 'actual' ? 'primary' : 'outline'}>{PRICE_TYPE_LABEL[type]}</Badge>
}

export function SourceLink({ record }: { record: Pick<PriceRecord, 'sourceUrl'> }) {
  if (!record.sourceUrl) return <Badge variant="warn">출처 미확인</Badge>
  let host = record.sourceUrl
  try {
    host = new URL(record.sourceUrl).hostname.replace(/^www\./, '')
  } catch {
    /* 그대로 표시 */
  }
  return (
    <a href={record.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      {host}
      <ExternalLink className="size-3" />
    </a>
  )
}

/** 한국 관례: 상승 빨강, 하락 파랑. 화살표 기호를 함께 써서 색만으로 구분하지 않는다. */
export function ChangeText({ change, showAmount = true, className }: { change: Change | null; showAmount?: boolean; className?: string }) {
  if (!change) return <span className={cn('text-muted-foreground', className)}>—</span>
  const up = change.diffWon > 0
  const flat = change.diffWon === 0
  return (
    <span className={cn('tabular', flat ? 'text-muted-foreground' : up ? 'text-up' : 'text-down', className)}>
      {flat ? '–' : up ? '▲' : '▼'} {formatPct(change.ratePct)}
      {showAmount && !flat && <span className="ml-1 text-xs opacity-80">({formatDiff(change.diffWon)})</span>}
    </span>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-10 text-center">
      <Inbox className="mb-2 size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="mt-1 max-w-md text-xs text-muted-foreground">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Warn({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900 ring-1 ring-orange-200">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular sm:text-xl">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}
