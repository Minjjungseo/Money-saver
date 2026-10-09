import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Table, Td, Th } from '@/components/ui/table'
import { ApartmentPicker } from '@/components/ApartmentPicker'
import { CompareChart, EncodingLegend } from '@/components/CompareChart'
import { EmptyState, PageHeader, PriceTypeBadge, SampleBadge, Warn } from '@/components/bits'
import { basisDate } from '@/lib/calc'
import { areaText, buildCompareChart, periodStart, PERIOD_LABEL, resolveItems, SERIES_COLORS, seriesStats, type Period } from '@/lib/compare'
import { formatDate, todayISO } from '@/lib/date'
import { formatKoreanWon, formatPct } from '@/lib/money'
import { apartmentUrl } from '@/lib/routes'
import { regionPath, unitChip, unitsOf } from '@/lib/selectors'
import { cn } from '@/lib/utils'
import { Segmented } from '@/components/Segmented'
import { addToCompare, clearCompare, MAX_COMPARE, removeFromCompare, setCompareUnit } from '@/store/ops'
import { update, useData } from '@/store/store'
import { PRICE_KIND_LABEL, PRICE_TYPE_LABEL, type PriceKind, type PriceType } from '@/store/schema'

type KindMode = 'sale' | 'jeonse' | 'both'
const KIND_MODE_LABEL: Record<KindMode, string> = { sale: '매매', jeonse: '전세', both: '매매+전세' }

export function ComparePage() {
  const data = useData()
  const today = todayISO()
  const [period, setPeriod] = useState<Period>('all')
  const [kindMode, setKindMode] = useState<KindMode>('sale')
  const [types, setTypes] = useState<PriceType[]>(['actual', 'asking', 'other'])
  const refs = data.settings.compare
  const items = useMemo(() => resolveItems(data, refs), [data, refs])
  const from = periodStart(period, today)
  const kinds: PriceKind[] = useMemo(() => (kindMode === 'both' ? ['sale', 'jeonse'] : [kindMode]), [kindMode])
  const chart = useMemo(() => buildCompareChart(data.prices, items, { kinds, types, from }), [data.prices, items, kinds, types, from])

  const unitIds = new Set(items.map((i) => i.unit?.id).filter(Boolean))
  const latestAny = data.prices
    .filter((p) => unitIds.has(p.unitId) && kinds.includes(p.kind) && types.includes(p.priceType))
    .map(basisDate)
    .sort()
    .at(-1)

  const toggleType = (t: PriceType) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  return (
    <>
      <PageHeader title="랜드마크 가격 비교" description="비교 목록의 단지를 한 그래프에 그립니다. 점은 실제 기록이고, 기록이 없는 시점의 가격은 만들지 않습니다." />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        {/* 비교 목록 (모바일에서는 그래프 아래) */}
        <div className="order-2 space-y-4 lg:order-1">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>비교 목록 ({items.length}/{MAX_COMPARE})</CardTitle>
                <CardDescription>색은 목록 순서대로 고정됩니다. 면적을 바꿔 같은 면적끼리 맞춰 보세요.</CardDescription>
              </div>
              {items.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => update(clearCompare)}>
                  비우기
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && <p className="text-sm text-muted-foreground">아래에서 단지를 추가하세요.</p>}
              {items.map((it, i) => {
                const units = unitsOf(data, it.apartment.id)
                return (
                  <div key={it.apartment.id} className="rounded-lg border p-2.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-1 inline-block size-3 shrink-0 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <Link to={apartmentUrl(it.apartment.id)} className="flex items-center gap-1 font-medium hover:underline">
                          <span className="truncate">{it.apartment.name}</span>
                          <SampleBadge show={it.apartment.isSample} />
                        </Link>
                        <div className="truncate text-xs text-muted-foreground">{regionPath(data, it.apartment.regionId)}</div>
                      </div>
                      <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="목록에서 빼기" onClick={() => update((d) => removeFromCompare(d, it.apartment.id))}>
                        <X className="size-4" />
                      </button>
                    </div>
                    {units.length > 0 && (
                      <Select
                        className="mt-2 h-8 text-xs"
                        value={it.unit?.id ?? ''}
                        onChange={(e) => update((d) => setCompareUnit(d, it.apartment.id, e.target.value || null))}
                        aria-label="기준 면적"
                      >
                        {units.map((u) => (
                          <option key={u.id} value={u.id}>
                            기준 면적: {unitChip(u)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>단지 추가</CardTitle>
            </CardHeader>
            <CardContent>
              <ApartmentPicker
                data={data}
                selected={refs.map((r) => r.apartmentId)}
                disabled={refs.length >= MAX_COMPARE}
                limit={20}
                onPick={(id) => update((d) => addToCompare(d, { apartmentId: id, unitId: null }))}
              />
              {refs.length >= MAX_COMPARE && <p className="mt-2 text-xs text-muted-foreground">최대 {MAX_COMPARE}개까지 비교합니다. 그 이상은 그래프를 읽기 어렵습니다.</p>}
            </CardContent>
          </Card>
        </div>

        {/* 그래프 + 표 */}
        <div className="order-1 min-w-0 space-y-4 lg:order-2">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 pt-4">
              <Segmented value={period} options={Object.entries(PERIOD_LABEL) as [Period, string][]} onChange={setPeriod} label="기간" />
              <Segmented value={kindMode} options={Object.entries(KIND_MODE_LABEL) as [KindMode, string][]} onChange={setKindMode} label="종류" />
              <div className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">유형</span>
                {(Object.keys(PRICE_TYPE_LABEL) as PriceType[]).map((t) => (
                  <label key={t} className="flex items-center gap-1">
                    <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} className="size-4 accent-primary" />
                    {PRICE_TYPE_LABEL[t]}
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {items.length === 0 ? (
            <EmptyState title="비교할 단지를 추가하세요">단지 목록·상세 화면의 [비교에 추가] 버튼으로도 넣을 수 있습니다.</EmptyState>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>
                      {KIND_MODE_LABEL[kindMode]} 가격 추이 · {PERIOD_LABEL[period]}
                      {from && <span className="ml-1 text-xs font-normal text-muted-foreground">({formatDate(from)} ~ 오늘)</span>}
                    </CardTitle>
                    <CardDescription>
                      점 = 실제 기록(기준일). 같은 시계열의 기록 사이는 선으로 이었지만 그 사이 가격 자료는 없습니다. 6개월 넘게 기록이 없으면 선을 끊습니다.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {chart.series.length === 0 ? (
                    <Warn>
                      선택한 기간·조건에 기록이 없습니다.
                      {latestAny ? ` 이 단지들의 가장 최근 기록은 ${formatDate(latestAny)}입니다. 기간을 '전체'로 바꿔 보세요.` : ''}
                    </Warn>
                  ) : (
                    <>
                      <CompareChart chart={chart} items={items} />
                      <EncodingLegend />
                    </>
                  )}
                  {types.length === 3 && chart.series.some((s) => s.priceType !== 'actual') && (
                    <p className="text-xs text-muted-foreground">실거래가와 호가·기타는 기준이 달라 직접 비교하기 어렵습니다. 유형을 하나만 골라 보는 것을 권합니다.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>단지별 요약 ({PERIOD_LABEL[period]} 기간 내 기록 기준)</CardTitle>
                    <CardDescription>최고점 대비 = (최근 가격 − 기간 내 최고가) ÷ 최고가. 시계열(종류·유형)마다 따로 계산합니다.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="px-0 sm:px-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th className="pl-4 sm:pl-5">단지 · 기준 면적</Th>
                        <Th>시계열</Th>
                        <Th className="text-right">최근 가격</Th>
                        <Th className="text-right">최고가</Th>
                        <Th className="text-right">최저가</Th>
                        <Th className="pr-4 text-right sm:pr-5">최고점 대비</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {chart.series.map((s) => {
                        const st = seriesStats(s.records)!
                        const it = items[s.itemIndex]
                        return (
                          <tr key={s.key}>
                            <Td className="pl-4 sm:pl-5">
                              <div className="flex items-center gap-1.5 whitespace-nowrap font-medium">
                                <span className="inline-block size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
                                {it.apartment.name}
                              </div>
                              <div className="text-xs text-muted-foreground">{areaText(it.unit)}</div>
                            </Td>
                            <Td className="whitespace-nowrap">
                              {PRICE_KIND_LABEL[s.kind]} <PriceTypeBadge type={s.priceType} />
                              <div className="text-[11px] text-muted-foreground">기록 {st.count}건</div>
                            </Td>
                            <Td className="text-right whitespace-nowrap">
                              <div className="font-semibold">{formatKoreanWon(st.latest.amountWon)}</div>
                              <div className="text-[11px] text-muted-foreground">
                                기준 {formatDate(basisDate(st.latest))} · 조사 {formatDate(st.latest.surveyDate)}
                              </div>
                            </Td>
                            <Td className="text-right whitespace-nowrap">
                              <div>{formatKoreanWon(st.max.amountWon)}</div>
                              <div className="text-[11px] text-muted-foreground">{formatDate(basisDate(st.max))}</div>
                            </Td>
                            <Td className="text-right whitespace-nowrap">
                              <div>{formatKoreanWon(st.min.amountWon)}</div>
                              <div className="text-[11px] text-muted-foreground">{formatDate(basisDate(st.min))}</div>
                            </Td>
                            <Td className={cn('pr-4 text-right whitespace-nowrap tabular sm:pr-5', st.fromPeakPct < 0 ? 'text-down' : 'text-muted-foreground')}>
                              {st.fromPeakPct < 0 ? `▼ ${formatPct(st.fromPeakPct)}` : '최고가'}
                            </Td>
                          </tr>
                        )
                      })}
                      {items
                        .filter((_, i) => !chart.series.some((s) => s.itemIndex === i))
                        .map((it) => (
                          <tr key={it.apartment.id}>
                            <Td className="pl-4 sm:pl-5 font-medium">{it.apartment.name}</Td>
                            <Td colSpan={5} className="text-xs text-muted-foreground">
                              선택한 기간·조건에 기록 없음 (데이터 없음)
                            </Td>
                          </tr>
                        ))}
                    </tbody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  )
}
