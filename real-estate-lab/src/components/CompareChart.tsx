import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TYPE_DASH, type CompareChart as ChartData, type ResolvedItem } from '@/lib/compare'
import { basisDate } from '@/lib/calc'
import { formatDate, formatShortDate } from '@/lib/date'
import { formatKoreanWon } from '@/lib/money'
import { unitChip } from '@/lib/selectors'
import { PRICE_KIND_LABEL, PRICE_TYPE_LABEL } from '@/store/schema'

const axisTick = { fontSize: 11, fill: '#64748b' }

/**
 * 색 = 단지(비교 목록 순서), 선 모양 = 가격 유형, 굵기·채움 = 매매(굵게·채움) / 전세(가늘게·빈 점).
 * 각 선 조각은 실제 기록만 잇는다. 6개월 넘는 공백은 조각이 나뉘어 선이 끊긴다.
 */
export function CompareChart({ chart, items, height = 360 }: { chart: ChartData; items: ResolvedItem[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="랜드마크 단지 가격 비교 그래프">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="#eef1f5" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatShortDate}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            minTickGap={28}
            padding={{ left: 12, right: 12 }}
          />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={46} tickFormatter={(v: number) => `${v}억`} domain={['auto', 'auto']} />
          <Tooltip
            cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }}
            content={({ active, label, payload }) => {
              if (!active || label == null || !payload?.length) return null
              const seen = new Set<string>()
              const lines = payload
                .filter((p) => p.value != null)
                .map((p) => chart.recordAt.get(`${String(p.dataKey)}@${label}`))
                .filter((r): r is NonNullable<typeof r> => !!r && !seen.has(r.id) && !!seen.add(r.id))
              if (!lines.length) return null
              return (
                <div className="max-w-xs rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
                  <div className="mb-1 font-medium text-muted-foreground">기준일 {formatDate(basisDate(lines[0]))}</div>
                  {lines.map((r) => {
                    const s = chart.series.find((x) => x.unitId === r.unitId && x.kind === r.kind && x.priceType === r.priceType)!
                    const item = items[s.itemIndex]
                    return (
                      <div key={r.id} className="mt-1">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                          <span className="font-medium">{item.apartment.name}</span>
                          <span className="ml-auto font-semibold tabular">{formatKoreanWon(r.amountWon)}</span>
                        </div>
                        <div className="pl-3.5 text-muted-foreground">
                          {PRICE_KIND_LABEL[r.kind]} · {PRICE_TYPE_LABEL[r.priceType]} · {item.unit ? unitChip(item.unit) : ''} · 조사 {formatDate(r.surveyDate)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }}
          />
          {chart.series.flatMap((s) =>
            s.segments.map((seg) => (
              <Line
                key={seg}
                dataKey={seg}
                stroke={s.color}
                strokeWidth={s.kind === 'sale' ? 2.5 : 1.5}
                strokeDasharray={TYPE_DASH[s.priceType]}
                connectNulls
                isAnimationActive={false}
                legendType="none"
                dot={{ r: 3.5, strokeWidth: 2, stroke: s.color, fill: s.kind === 'sale' ? s.color : '#fff' }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2, fill: s.color }}
              />
            )),
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 선 모양 범례 (색은 단지 목록에 표시) */
export function EncodingLegend() {
  const line = (dash?: string, width = 2.5, hollow = false) => (
    <svg width="34" height="10" aria-hidden>
      <line x1="2" y1="5" x2="32" y2="5" stroke="#475569" strokeWidth={width} strokeDasharray={dash} />
      <circle cx="17" cy="5" r="3" fill={hollow ? '#fff' : '#475569'} stroke="#475569" strokeWidth="1.5" />
    </svg>
  )
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">{line()}매매 실거래가</span>
      <span className="flex items-center gap-1">{line(undefined, 1.5, true)}전세 (가는 선·빈 점)</span>
      <span className="flex items-center gap-1">{line(TYPE_DASH.asking)}호가</span>
      <span className="flex items-center gap-1">{line(TYPE_DASH.other)}기타·과거자료</span>
    </div>
  )
}
