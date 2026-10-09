/**
 * 2단계 분석 계산: 랜드마크 비교 그래프, 생활권 요약, 가격 구간, 저평가 후보의 가격 차이.
 *
 * 원칙
 * - 실제 기록만 쓴다. 기록이 없는 시점의 가격은 만들지 않는다(보간 없음).
 * - 실거래가·호가·기타는 각각 다른 시계열.
 * - 기록 간격이 GAP_BREAK_DAYS 를 넘으면 그래프 선을 끊어, 사이 기간을 이어 그린 것처럼 보이지 않게 한다.
 * - '저평가' 같은 판단은 하지 않는다. 사실(가격 차이, 연식·세대수 차이)과 주의사항만 계산한다.
 */
import type { Apartment, ApartmentUnit, AppData, ID, ISODate, PriceKind, PriceRecord, PriceType, UnitRef } from '@/store/schema'
import { basisDate, headlineOf, latestOf, sortByBasis, RATIO_DATE_GAP_WARN_DAYS } from './calc'
import { addMonths, daysBetween, isoToUTC } from './date'
import { WON_PER_EOK } from './money'
import { primaryUnit } from './selectors'

// ================= 기간 =================

export type Period = '1y' | '3y' | '5y' | 'all'
export const PERIOD_LABEL: Record<Period, string> = { '1y': '1년', '3y': '3년', '5y': '5년', all: '전체' }

/** 오늘 기준 기간 시작일 (전체면 null) */
export function periodStart(period: Period, today: ISODate): ISODate | null {
  if (period === 'all') return null
  return addMonths(today, -12 * Number(period[0]))
}

// ================= 비교 그래프 =================

/** 기록 사이가 이보다 멀면 선을 끊는다 (약 6개월) */
export const GAP_BREAK_DAYS = 190

/** 범주형 색 8개 — 비교 목록에 넣은 순서대로 고정 배정 (순위로 바꾸지 않음) */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
export const TYPE_DASH: Record<PriceType, string | undefined> = { actual: undefined, asking: '6 4', other: '2 3' }

export interface CompareSeries {
  key: string
  itemIndex: number
  apartmentId: ID
  unitId: ID
  kind: PriceKind
  priceType: PriceType
  color: string
  /** 기간 안의 기록 (기준일 오름차순) */
  records: PriceRecord[]
  /** 선 조각 키 (간격이 길면 여러 조각) */
  segments: string[]
}

export interface CompareRow {
  t: number
  [segment: string]: number | null
}

export interface CompareChart {
  rows: CompareRow[]
  series: CompareSeries[]
  /** `${segmentKey}@${t}` → 원본 기록 (툴팁용) */
  recordAt: Map<string, PriceRecord>
}

export interface ResolvedItem {
  apartment: Apartment
  unit: ApartmentUnit | null
}

/** 비교 목록 항목의 면적: 지정한 면적, 없으면 대표 면적 */
export function resolveItems(d: AppData, refs: UnitRef[]): ResolvedItem[] {
  const out: ResolvedItem[] = []
  for (const r of refs) {
    const apartment = d.apartments.find((a) => a.id === r.apartmentId)
    if (!apartment) continue
    const unit = (r.unitId && d.units.find((u) => u.id === r.unitId && u.apartmentId === apartment.id)) || primaryUnit(d, apartment.id)
    out.push({ apartment, unit })
  }
  return out
}

export function buildCompareChart(
  prices: PriceRecord[],
  items: ResolvedItem[],
  opts: { kinds: PriceKind[]; types: PriceType[]; from: ISODate | null },
): CompareChart {
  const series: CompareSeries[] = []
  const byT = new Map<number, CompareRow>()
  const recordAt = new Map<string, PriceRecord>()

  items.forEach((item, itemIndex) => {
    if (!item.unit) return
    for (const kind of opts.kinds) {
      for (const priceType of opts.types) {
        const records = sortByBasis(
          prices.filter(
            (p) =>
              p.unitId === item.unit!.id &&
              p.kind === kind &&
              p.priceType === priceType &&
              (opts.from == null || basisDate(p) >= opts.from),
          ),
        )
        if (records.length === 0) continue
        const key = `s${itemIndex}_${kind}_${priceType}`
        const segments: string[] = []
        let seg = -1
        let prevDate: ISODate | null = null
        for (const r of records) {
          const date = basisDate(r)
          if (prevDate == null || daysBetween(prevDate, date) > GAP_BREAK_DAYS) {
            seg++
            segments.push(`${key}_${seg}`)
          }
          prevDate = date
          const segKey = `${key}_${seg}`
          const t = isoToUTC(date)
          const row = byT.get(t) ?? { t }
          // 같은 기준일에 여러 건이면 나중 기록 (sortByBasis 순서상 마지막)
          row[segKey] = r.amountWon / WON_PER_EOK
          byT.set(t, row)
          recordAt.set(`${segKey}@${t}`, r)
        }
        series.push({
          key,
          itemIndex,
          apartmentId: item.apartment.id,
          unitId: item.unit.id,
          kind,
          priceType,
          color: SERIES_COLORS[itemIndex % SERIES_COLORS.length],
          records,
          segments,
        })
      }
    }
  })

  return { rows: [...byT.values()].sort((a, b) => a.t - b.t), series, recordAt }
}

export interface SeriesStats {
  latest: PriceRecord
  max: PriceRecord
  min: PriceRecord
  /** 최고점 대비 최근 가격 변화율(%) — 0 이하 */
  fromPeakPct: number
  count: number
}

export function seriesStats(records: PriceRecord[]): SeriesStats | null {
  if (records.length === 0) return null
  const sorted = sortByBasis(records)
  const latest = sorted.at(-1)!
  let max = sorted[0]
  let min = sorted[0]
  for (const r of sorted) {
    // 같은 값이면 더 최근 기록을 최고·최저로
    if (r.amountWon >= max.amountWon) max = r
    if (r.amountWon <= min.amountWon) min = r
  }
  return { latest, max, min, fromPeakPct: ((latest.amountWon - max.amountWon) / max.amountWon) * 100, count: sorted.length }
}

// ================= 가격 구간 =================

export interface Band {
  lo: number
  hi: number
  label: string
}

/** step 억 단위 구간. 10억, step 5 → [10억, 15억) */
export function bandOf(won: number, stepEok: number): Band {
  const eok = won / WON_PER_EOK
  const lo = Math.floor(eok / stepEok) * stepEok
  return { lo, hi: lo + stepEok, label: `${lo}억 이상 ~ ${lo + stepEok}억 미만` }
}

// ================= 비슷한 조건 필터 =================

export type AgeBucket = 'new' | 'mid' | 'old' | 'veryOld' | 'unknown'
export const AGE_LABEL: Record<AgeBucket, string> = { new: '5년 이하', mid: '6~10년', old: '11~20년', veryOld: '21년 이상', unknown: '준공연도 미입력' }

/** 연차 = 올해 - 준공연도 + 1 */
export function ageBucket(builtYear: number | null, year: number): AgeBucket {
  if (builtYear == null) return 'unknown'
  const age = year - builtYear + 1
  if (age <= 5) return 'new'
  if (age <= 10) return 'mid'
  if (age <= 20) return 'old'
  return 'veryOld'
}

export type AreaBucket = 'small' | 'mid' | 'large' | 'unknown'
export const AREA_LABEL: Record<AreaBucket, string> = { small: '전용 60㎡ 이하', mid: '전용 60~85㎡', large: '전용 85㎡ 초과', unknown: '전용면적 미확인' }

/** 전용면적 기준. 평형만 있는 면적은 추정하지 않고 '미확인' */
export function areaBucket(u: ApartmentUnit | null): AreaBucket {
  if (!u || u.exclusiveArea == null) return 'unknown'
  if (u.exclusiveArea <= 60) return 'small'
  if (u.exclusiveArea <= 85) return 'mid'
  return 'large'
}

export type HouseholdBucket = 'lt500' | '500' | '1000' | '2000' | 'unknown'
export const HOUSEHOLD_LABEL: Record<HouseholdBucket, string> = { lt500: '500세대 미만', '500': '500~999세대', '1000': '1,000~1,999세대', '2000': '2,000세대 이상', unknown: '세대수 미입력' }

export function householdBucket(h: number | null): HouseholdBucket {
  if (h == null) return 'unknown'
  if (h < 500) return 'lt500'
  if (h < 1000) return '500'
  if (h < 2000) return '1000'
  return '2000'
}

// ================= 생활권 요약 =================

export interface AreaMember {
  apartment: Apartment
  unit: ApartmentUnit | null
  sale: PriceRecord | null
}

export interface AreaSummary {
  members: AreaMember[]
  priced: AreaMember[]
  min: AreaMember | null
  max: AreaMember | null
  /** 매매 대표가격 중앙값 (원) */
  medianWon: number | null
  representative: AreaMember | null
  types: Set<PriceType>
  latestBasis: ISODate | null
  oldestBasis: ISODate | null
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

export function summarizeArea(d: AppData, apartmentIds: ID[], representativeId: ID | null): AreaSummary {
  const members: AreaMember[] = []
  for (const id of apartmentIds) {
    const apartment = d.apartments.find((a) => a.id === id)
    if (!apartment) continue
    const unit = primaryUnit(d, apartment.id)
    const sale = unit ? headlineOf(d.prices, unit.id, 'sale') : null
    members.push({ apartment, unit, sale })
  }
  const priced = members.filter((m) => m.sale)
  const by = (a: AreaMember, b: AreaMember) => a.sale!.amountWon - b.sale!.amountWon
  const sorted = [...priced].sort(by)
  const dates = priced.map((m) => basisDate(m.sale!)).sort()
  return {
    members,
    priced,
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null,
    medianWon: median(priced.map((m) => m.sale!.amountWon)),
    representative: members.find((m) => m.apartment.id === representativeId) ?? null,
    types: new Set(priced.map((m) => m.sale!.priceType)),
    latestBasis: dates.at(-1) ?? null,
    oldestBasis: dates[0] ?? null,
  }
}

// ================= 저평가 후보: 가격 차이 =================

export interface PricePair {
  target: PriceRecord | null
  other: PriceRecord | null
  /** 둘 다 있는 같은 가격 유형으로 맞췄는지 */
  sameType: boolean
}

/**
 * 두 면적의 매매가를 비교할 기록 고르기.
 * 실거래가끼리 → 같은 유형끼리(최근 것) → 없으면 각자의 대표 가격(유형 불일치 경고).
 */
export function pairPrices(prices: PriceRecord[], targetUnitId: ID, otherUnitId: ID, kind: PriceKind = 'sale'): PricePair {
  for (const t of ['actual', 'asking', 'other'] as PriceType[]) {
    const a = latestOf(prices, targetUnitId, kind, t)
    const b = latestOf(prices, otherUnitId, kind, t)
    if (a && b) return { target: a, other: b, sameType: true }
  }
  return { target: headlineOf(prices, targetUnitId, kind), other: headlineOf(prices, otherUnitId, kind), sameType: false }
}

export interface GapRow {
  apartment: Apartment
  unit: ApartmentUnit | null
  pair: PricePair
  /** 비교 단지 - 대상 단지 (원). 양수면 대상이 그만큼 낮다 */
  diffWon: number | null
  /** 대상 가격이 비교 단지 대비 몇 % 다른지 (음수면 낮음) */
  targetVsOtherPct: number | null
  builtYearDiff: number | null
  householdsDiff: number | null
  warnings: string[]
}

export function areaText(u: ApartmentUnit | null): string {
  if (!u) return '면적 없음'
  if (u.exclusiveArea != null) return `전용 ${u.exclusiveArea}㎡`
  if (u.pyeong != null) return `${u.pyeong}평형(전용 미확인)`
  return u.label ?? '면적 미확인'
}

export function gapRow(d: AppData, target: ResolvedItem, other: ResolvedItem): GapRow {
  const warnings: string[] = []
  const pair: PricePair =
    target.unit && other.unit ? pairPrices(d.prices, target.unit.id, other.unit.id) : { target: null, other: null, sameType: false }
  let diffWon: number | null = null
  let pct: number | null = null
  if (pair.target && pair.other) {
    diffWon = pair.other.amountWon - pair.target.amountWon
    pct = ((pair.target.amountWon - pair.other.amountWon) / pair.other.amountWon) * 100
    if (!pair.sameType) warnings.push('가격 유형이 서로 다릅니다 (예: 실거래가 vs 호가)')
    const gap = Math.abs(daysBetween(basisDate(pair.target), basisDate(pair.other)))
    if (gap > RATIO_DATE_GAP_WARN_DAYS) warnings.push(`기준일이 ${gap}일 차이납니다`)
    if (pair.target.legacy || pair.other.legacy) warnings.push('과거자료(가격 기준 불명확)가 포함되어 있습니다')
  } else {
    warnings.push('비교할 매매가격 기록이 없습니다')
  }
  const ta = target.unit?.exclusiveArea ?? null
  const oa = other.unit?.exclusiveArea ?? null
  if (ta != null && oa != null) {
    if (Math.abs(ta - oa) > 5) warnings.push(`전용면적이 다릅니다 (${ta}㎡ vs ${oa}㎡) — 총액 차이에 면적 차이가 섞여 있습니다`)
  } else {
    warnings.push('전용면적이 확인되지 않아 같은 면적끼리의 비교인지 알 수 없습니다')
    const tp = target.unit?.pyeong ?? null
    const op = other.unit?.pyeong ?? null
    if (tp != null && op != null && tp !== op) warnings.push(`평형이 다릅니다 (${tp}평 vs ${op}평)`)
  }
  const ty = target.apartment.builtYear
  const oy = other.apartment.builtYear
  const th = target.apartment.households
  const oh = other.apartment.households
  return {
    apartment: other.apartment,
    unit: other.unit,
    pair,
    diffWon,
    targetVsOtherPct: pct,
    builtYearDiff: ty != null && oy != null ? ty - oy : null,
    householdsDiff: th != null && oh != null ? th - oh : null,
    warnings,
  }
}

