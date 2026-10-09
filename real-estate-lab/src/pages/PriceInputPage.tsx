import { useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { ApartmentFormDialog, Field } from '@/components/ApartmentFormDialog'
import { RegionPicker } from '@/components/RegionPicker'
import { ChangeText, PageHeader, SampleBadge, Warn } from '@/components/bits'
import { toast } from '@/components/toast'
import { RATIO_DATE_GAP_WARN_DAYS, diff, jeonseRatio, latestOf } from '@/lib/calc'
import { daysBetween, formatDate, todayISO } from '@/lib/date'
import { formatKoreanWon, formatPct, parseEok } from '@/lib/money'
import { apartmentUrl } from '@/lib/routes'
import { descendantIds, unitChip, unitsOf } from '@/lib/selectors'
import { checkArea, checkDate, checkUrl, type Errors } from '@/lib/validate'
import { cn } from '@/lib/utils'
import { addPriceEntry, findOrCreateUnit, findUnit, type PricePart } from '@/store/ops'
import { update, useData } from '@/store/store'
import { PRICE_KIND_LABEL, PRICE_TYPE_LABEL, type PriceKind, type PriceRecord, type PriceType } from '@/store/schema'

const NEW_UNIT = '__new__'

export function PriceInputPage() {
  const data = useData()
  const [params] = useSearchParams()
  const initApt = data.apartments.find((a) => a.id === params.get('apt'))
  const today = todayISO()

  const [regionId, setRegionId] = useState(initApt?.regionId ?? '')
  const [aptId, setAptId] = useState(initApt?.id ?? '')
  const [unitSel, setUnitSel] = useState(params.get('unit') ?? '')
  const [area, setArea] = useState('')
  const [areaLabel, setAreaLabel] = useState('')
  const [surveyDate, setSurveyDate] = useState(today)
  const [priceType, setPriceType] = useState<PriceType>('actual')
  const [sale, setSale] = useState({ amount: '', dealDate: '' })
  const [jeonse, setJeonse] = useState({ amount: '', dealDate: '' })
  const [sourceUrl, setSourceUrl] = useState('')
  const [memo, setMemo] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [addingApt, setAddingApt] = useState(false)
  const [lastSaved, setLastSaved] = useState<{ aptId: string; text: string } | null>(null)

  const aptOptions = useMemo(() => {
    if (!regionId) return []
    const ids = descendantIds(data, regionId)
    return data.apartments.filter((a) => ids.has(a.regionId)).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [data, regionId])
  const apt = data.apartments.find((a) => a.id === aptId) ?? null
  const units = apt ? unitsOf(data, apt.id) : []
  const unitChoice = units.some((u) => u.id === unitSel) ? unitSel : units.length ? (unitSel === NEW_UNIT ? NEW_UNIT : units[0].id) : NEW_UNIT
  // 새 면적으로 입력했지만 이미 같은 면적이 있으면 그것을 사용
  const unit =
    unitChoice === NEW_UNIT
      ? apt && !checkArea(area)
        ? (findUnit(data, apt.id, { area: Number(area), label: areaLabel || null }) ?? null)
        : null
      : (units.find((u) => u.id === unitChoice) ?? null)

  const saleAmt = sale.amount ? parseEok(sale.amount) : null
  const jeonseAmt = jeonse.amount ? parseEok(jeonse.amount) : null
  const saleWon = saleAmt?.ok ? saleAmt.won : null
  const jeonseWon = jeonseAmt?.ok ? jeonseAmt.won : null

  function prevOf(kind: PriceKind): PriceRecord | null {
    if (!unit) return null
    return latestOf(data.prices, unit.id, kind, priceType)
  }

  function save() {
    const e: Errors = {}
    if (!apt) e.apt = '단지를 선택하거나 새로 추가하세요'
    if (unitChoice === NEW_UNIT) {
      const ae = checkArea(area)
      if (ae) e.area = ae
    }
    const sd = checkDate(surveyDate, '조사일', { required: true })
    if (sd) e.surveyDate = sd
    if (!sale.amount && !jeonse.amount) e.amounts = '매매가격 또는 전세가격 중 하나 이상 입력하세요'
    if (saleAmt && !saleAmt.ok) e.sale = saleAmt.error
    if (jeonseAmt && !jeonseAmt.ok) e.jeonse = jeonseAmt.error
    const d1 = checkDate(sale.dealDate, '거래일')
    if (d1) e.saleDate = d1
    const d2 = checkDate(jeonse.dealDate, '거래일')
    if (d2) e.jeonseDate = d2
    if (!e.surveyDate && !e.saleDate && sale.dealDate && sale.dealDate > surveyDate) e.saleDate = '거래일이 조사일보다 늦습니다'
    if (!e.surveyDate && !e.jeonseDate && jeonse.dealDate && jeonse.dealDate > surveyDate) e.jeonseDate = '거래일이 조사일보다 늦습니다'
    if (saleWon != null && jeonseWon != null && jeonseWon > saleWon * 1.5) e.jeonse = '전세가가 매매가보다 50% 이상 높습니다. 단위를 확인하세요'
    const ue = checkUrl(sourceUrl)
    if (ue) e.sourceUrl = ue
    setErrors(e)
    if (Object.keys(e).length || !apt) return

    const part = (won: number | null, dealDate: string): PricePart | null => (won == null ? null : { amountWon: won, dealDate: dealDate || null })
    let result: { created: PriceRecord[]; skipped: PriceKind[] } = { created: [], skipped: [] }
    let savedUnitId = ''
    update((d) => {
      const u =
        unitChoice === NEW_UNIT
          ? findOrCreateUnit(d, apt.id, { area: Number(area), label: areaLabel || null })
          : { data: d, unit: d.units.find((x) => x.id === unitChoice)! }
      const r = addPriceEntry(u.data, {
        unitId: u.unit.id,
        surveyDate,
        priceType,
        sourceUrl: sourceUrl.trim() || null,
        memo: memo.trim() || null,
        sale: part(saleWon, sale.dealDate),
        jeonse: part(jeonseWon, jeonse.dealDate),
      })
      result = r
      savedUnitId = u.unit.id
      return r.data
    })
    setUnitSel(savedUnitId)
    if (result.skipped.length) {
      toast(`이미 똑같은 ${result.skipped.map((k) => PRICE_KIND_LABEL[k]).join('·')} 기록이 있어 건너뛰었습니다`, 'warn')
    }
    if (result.created.length) {
      toast(`${result.created.length}건 저장했습니다`)
      setLastSaved({ aptId: apt.id, text: result.created.map((r) => `${PRICE_KIND_LABEL[r.kind]} ${formatKoreanWon(r.amountWon)}`).join(' · ') })
      setSale({ amount: '', dealDate: '' })
      setJeonse({ amount: '', dealDate: '' })
      setMemo('')
    }
  }

  const gap = sale.dealDate && jeonse.dealDate && !checkDate(sale.dealDate, '') && !checkDate(jeonse.dealDate, '') ? Math.abs(daysBetween(sale.dealDate, jeonse.dealDate)) : null

  return (
    <>
      <PageHeader title="시세 직접 입력" description="AI·사이트에서 찾은 값을 직접 확인한 뒤 입력하세요. 출처가 없으면 '출처 미확인'으로 표시됩니다." />

      {lastSaved && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900 ring-1 ring-emerald-200">
          저장됨: {lastSaved.text}
          <Link to={apartmentUrl(lastSaved.aptId)} className="ml-auto inline-flex items-center gap-1 font-medium underline">
            단지 상세 보기 <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>1. 단지·면적</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="지역 *">
                <RegionPicker data={data} value={regionId} onChange={(v) => { setRegionId(v); setAptId(''); setUnitSel('') }} />
              </Field>
              <Field label="아파트 단지 *" error={errors.apt}>
                <div className="flex gap-2">
                  <Select value={aptId} onChange={(e) => { setAptId(e.target.value); setUnitSel('') }} disabled={!regionId} aria-invalid={!!errors.apt}>
                    <option value="">{!regionId ? '지역을 먼저 선택' : aptOptions.length ? '단지 선택' : '등록된 단지 없음 → 새 단지 추가'}</option>
                    {aptOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {a.isSample ? ' (예시)' : ''}
                      </option>
                    ))}
                  </Select>
                  <Button variant="outline" onClick={() => setAddingApt(true)} disabled={!regionId} className="shrink-0">
                    <Plus />
                    새 단지
                  </Button>
                </div>
              </Field>
              {apt && (
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
                  <Field label="전용면적 *">
                    <Select value={unitChoice} onChange={(e) => setUnitSel(e.target.value)}>
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {unitChip(u)}
                        </option>
                      ))}
                      <option value={NEW_UNIT}>+ 새 면적 입력</option>
                    </Select>
                  </Field>
                  {unitChoice === NEW_UNIT && (
                    <>
                      <Field label="전용면적(㎡) *" error={errors.area}>
                        <Input inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} placeholder="84.97" aria-invalid={!!errors.area} />
                      </Field>
                      <Field label="면적 타입" hint="예: 84A, 59B (선택)">
                        <Input value={areaLabel} onChange={(e) => setAreaLabel(e.target.value)} placeholder="84A" />
                      </Field>
                    </>
                  )}
                </div>
              )}
              {apt?.isSample && <Warn>예시 단지입니다. 실제 공부용 기록은 실제 단지를 추가해 입력하세요.</Warn>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. 가격</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="조사일 *" error={errors.surveyDate} hint="이 가격을 확인한 날">
                  <Input type="date" value={surveyDate} max={today} onChange={(e) => setSurveyDate(e.target.value)} />
                </Field>
                <Field label="가격 유형 *">
                  <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                    {(Object.keys(PRICE_TYPE_LABEL) as PriceType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setPriceType(t)}
                        className={cn('h-8 rounded-md text-sm text-muted-foreground', priceType === t && 'bg-card font-medium text-primary shadow-sm')}
                      >
                        {PRICE_TYPE_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {(['sale', 'jeonse'] as const).map((kind) => {
                const v = kind === 'sale' ? sale : jeonse
                const setV = kind === 'sale' ? setSale : setJeonse
                const won = kind === 'sale' ? saleWon : jeonseWon
                return (
                  <div key={kind} className="rounded-lg border p-3">
                    <div className="mb-2 text-sm font-semibold">{PRICE_KIND_LABEL[kind]}</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={`${PRICE_KIND_LABEL[kind]}가격 (억 원)`} error={errors[kind]} hint={won != null ? `= ${formatKoreanWon(won)}원` : '예: 12.35 → 12억 3,500만'}>
                        <Input inputMode="decimal" value={v.amount} onChange={(e) => setV({ ...v, amount: e.target.value })} placeholder="12.35" aria-invalid={!!errors[kind]} />
                      </Field>
                      <Field label="거래일 또는 가격 기준일" error={errors[kind === 'sale' ? 'saleDate' : 'jeonseDate']} hint="모르면 비워 두세요 (조사일을 기준으로 사용)">
                        <Input type="date" value={v.dealDate} max={today} onChange={(e) => setV({ ...v, dealDate: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                )
              })}
              {errors.amounts && <p className="text-xs text-destructive">{errors.amounts}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. 출처·메모</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="출처 URL" error={errors.sourceUrl} hint="국토부 실거래가, 네이버 부동산, 호갱노노 등. 비우면 '출처 미확인'">
                <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://rt.molit.go.kr/..." inputMode="url" />
              </Field>
              <Field label="메모">
                <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="층, 동, 특이사항 등" />
              </Field>
            </CardContent>
          </Card>
        </div>

        {/* 미리보기 */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>저장 전 확인</CardTitle>
                <CardDescription>자동 계산 · 같은 면적, 같은 가격 유형의 직전 기록과 비교</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="단지">
                {apt ? (
                  <span className="flex items-center gap-1">
                    {apt.name} <SampleBadge show={apt.isSample} />
                  </span>
                ) : '—'}
              </Row>
              <Row label="면적">{unit ? unitChip(unit) : unitChoice === NEW_UNIT && area ? `${area}㎡ (새 면적)` : '—'}</Row>
              <Row label="유형">{PRICE_TYPE_LABEL[priceType]}</Row>
              {(['sale', 'jeonse'] as const).map((k) => {
                const won = k === 'sale' ? saleWon : jeonseWon
                const prev = prevOf(k)
                return (
                  <div key={k} className="rounded-lg bg-muted/60 p-2.5">
                    <Row label={PRICE_KIND_LABEL[k]}>
                      <b>{won != null ? formatKoreanWon(won) : '—'}</b>
                    </Row>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {prev ? (
                        <>
                          직전 {formatKoreanWon(prev.amountWon)} ({formatDate(prev.dealDate ?? prev.surveyDate)})
                          {won != null && (
                            <div className="mt-0.5">
                              변동 <ChangeText change={diff(prev, { ...prev, amountWon: won })} />
                            </div>
                          )}
                        </>
                      ) : (
                        '같은 유형의 직전 기록 없음'
                      )}
                    </div>
                  </div>
                )
              })}
              <Row label="전세가율">
                <b>{formatPct(jeonseRatio(saleWon, jeonseWon), 1, false)}</b>
              </Row>
              {gap != null && gap > RATIO_DATE_GAP_WARN_DAYS && <Warn>매매·전세 거래일이 {gap}일 차이납니다.</Warn>}
              {!sourceUrl.trim() && <Warn>출처가 없으면 '출처 미확인'으로 표시됩니다.</Warn>}
              <Button className="w-full" onClick={save}>
                저장
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ApartmentFormDialog
        open={addingApt}
        onClose={() => setAddingApt(false)}
        defaultRegionId={regionId}
        onSaved={(a) => {
          setRegionId(a.regionId)
          setAptId(a.id)
          setUnitSel(NEW_UNIT)
        }}
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  )
}
