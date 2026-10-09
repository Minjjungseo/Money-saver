import { useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { basisDate, ratioHistory } from '@/lib/calc'
import { formatShortDate, isoToUTC } from '@/lib/date'
import { formatKoreanWon, WON_PER_EOK } from '@/lib/money'
import { PRICE_KIND_LABEL, PRICE_TYPE_LABEL, type PriceKind, type PriceRecord, type PriceType } from '@/store/schema'

/** 색 = 매매/전세(정체성), 선 모양 = 가격 유형. 실거래가와 호가는 절대 한 선으로 잇지 않는다. */
const KIND_COLOR: Record<PriceKind, string> = { sale: '#2a78d6', jeonse: '#eb6834' }
const TYPE_DASH: Record<PriceType, string | undefined> = { actual: undefined, asking: '6 4', other: '2 3' }
const TYPES: PriceType[] = ['actual', 'asking', 'other']
const KINDS: PriceKind[] = ['sale', 'jeonse']

const axisTick = { fontSize: 11, fill: '#64748b' }

interface Row {
  t: number
  [series: string]: number | null
}

export function PriceHistoryChart({ prices, height = 300 }: { prices: PriceRecord[]; height?: number }) {
  const { rows, series } = useMemo(() => {
    const byT = new Map<number, Row>()
    const present = new Set<string>()
    for (const p of prices) {
      const t = isoToUTC(basisDate(p))
      const key = `${p.kind}_${p.priceType}`
      present.add(key)
      const row = byT.get(t) ?? { t }
      // 같은 날 같은 시계열에 여러 건이면 나중에 입력한 값
      row[key] = p.amountWon / WON_PER_EOK
      byT.set(t, row)
    }
    const series = KINDS.flatMap((k) => TYPES.map((ty) => ({ key: `${k}_${ty}`, kind: k, type: ty }))).filter((s) => present.has(s.key))
    const rows = [...byT.values()].sort((a, b) => a.t - b.t)
    for (const r of rows) for (const s of series) if (!(s.key in r)) r[s.key] = null
    return { rows, series }
  }, [prices])

  if (rows.length === 0) return <ChartEmpty height={height} />

  return (
    <div style={{ height }} role="img" aria-label="매매·전세 가격 추이 그래프">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#eef1f5" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={formatShortDate} tick={axisTick} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={24} padding={{ left: 12, right: 12 }} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v}억`} domain={['auto', 'auto']} />
          <Tooltip content={<PriceTooltip />} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="plainline" />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={`${PRICE_KIND_LABEL[s.kind]} ${PRICE_TYPE_LABEL[s.type]}`}
              stroke={KIND_COLOR[s.kind]}
              strokeWidth={2}
              strokeDasharray={TYPE_DASH[s.type]}
              connectNulls
              isAnimationActive={false}
              dot={{ r: 3.5, strokeWidth: 2, fill: s.type === 'actual' ? KIND_COLOR[s.kind] : '#fff', stroke: KIND_COLOR[s.kind] }}
              activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

interface TooltipProps {
  active?: boolean
  label?: number
  payload?: { name?: string; value?: number | null; color?: string }[]
}

function PriceTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length || label == null) return null
  const items = payload.filter((p) => p.value != null)
  if (!items.length) return null
  const d = new Date(label)
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium text-muted-foreground">
        기준일 {d.getUTCFullYear()}.{String(d.getUTCMonth() + 1).padStart(2, '0')}.{String(d.getUTCDate()).padStart(2, '0')}
      </div>
      {items.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-3" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold tabular">{formatKoreanWon(Math.round((p.value as number) * WON_PER_EOK))}</span>
        </div>
      ))}
    </div>
  )
}

const RATIO_COLOR = '#1e3a8a'

export function RatioChart({ prices, unitId, height = 200 }: { prices: PriceRecord[]; unitId: string; height?: number }) {
  const { rows, types } = useMemo(() => {
    const pts = ratioHistory(prices, unitId)
    const byT = new Map<number, Row>()
    const types = new Set<PriceType>()
    for (const p of pts) {
      const t = isoToUTC(p.date)
      const row = byT.get(t) ?? { t }
      row[p.priceType] = Math.round(p.ratio * 10) / 10
      types.add(p.priceType)
      byT.set(t, row)
    }
    const rows = [...byT.values()].sort((a, b) => a.t - b.t)
    for (const r of rows) for (const ty of types) if (!(ty in r)) r[ty] = null
    return { rows, types: TYPES.filter((t) => types.has(t)) }
  }, [prices, unitId])

  if (rows.length === 0) {
    return <ChartEmpty height={height} text="같은 날 함께 입력한 매매·전세 쌍이 있어야 전세가율 추이를 그릴 수 있어요" />
  }
  return (
    <div style={{ height }} role="img" aria-label="전세가율 추이 그래프">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#eef1f5" vertical={false} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={formatShortDate} tick={axisTick} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} minTickGap={24} padding={{ left: 12, right: 12 }} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v}%`} allowDecimals={false} domain={[(min: number) => Math.floor(min - 3), (max: number) => Math.ceil(max + 3)]} />
          <Tooltip
            formatter={(v) => [`${v}%`]}
            labelFormatter={(l) => `기준일 ${formatShortDate(Number(l))}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
          />
          {types.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />}
          {types.map((ty) => (
            <Line
              key={ty}
              dataKey={ty}
              name={`전세가율 (${PRICE_TYPE_LABEL[ty]})`}
              stroke={RATIO_COLOR}
              strokeWidth={2}
              strokeDasharray={TYPE_DASH[ty]}
              connectNulls
              isAnimationActive={false}
              dot={{ r: 3.5, strokeWidth: 2, fill: ty === 'actual' ? RATIO_COLOR : '#fff', stroke: RATIO_COLOR }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function ChartEmpty({ height, text = '가격 기록이 없습니다' }: { height: number; text?: string }) {
  return (
    <div style={{ height }} className="flex items-center justify-center rounded-lg bg-muted/60 px-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  )
}
