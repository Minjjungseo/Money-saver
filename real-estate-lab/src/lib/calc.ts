import type { ISODate, PriceKind, PriceRecord, PriceType } from '@/store/schema'
import { addMonths, daysBetween } from './date'

/** 가격 기준일: 거래일이 있으면 거래일, 없으면 조사일 */
export function basisDate(r: Pick<PriceRecord, 'dealDate' | 'surveyDate'>): ISODate {
  return r.dealDate ?? r.surveyDate
}

/** 기준일 → 조사일 → 생성시각 순 오름차순 */
export function sortByBasis<T extends PriceRecord>(records: T[]): T[] {
  return [...records].sort(
    (a, b) =>
      basisDate(a).localeCompare(basisDate(b)) ||
      a.surveyDate.localeCompare(b.surveyDate) ||
      a.createdAt.localeCompare(b.createdAt),
  )
}

/**
 * 시계열 = 같은 면적 + 같은 가격 종류(매매/전세) + 같은 가격 유형(실거래/호가/기타).
 * 호가와 실거래가를 하나의 선으로 잇지 않기 위한 핵심 규칙.
 */
export function seriesOf(records: PriceRecord[], unitId: string, kind: PriceKind, priceType: PriceType): PriceRecord[] {
  return sortByBasis(records.filter((r) => r.unitId === unitId && r.kind === kind && r.priceType === priceType))
}

/** 가장 최근 기록. priceType을 주지 않으면 유형과 무관하게 가장 최근 것 */
export function latestOf(records: PriceRecord[], unitId: string, kind: PriceKind, priceType?: PriceType): PriceRecord | null {
  const list = sortByBasis(
    records.filter((r) => r.unitId === unitId && r.kind === kind && (priceType == null || r.priceType === priceType)),
  )
  return list.at(-1) ?? null
}

/**
 * 대표 가격: 실거래가가 있으면 가장 최근 실거래가, 없으면 유형과 무관하게 가장 최근 기록.
 * (더 최근의 호가가 있어도 실거래가를 기준으로 삼는다)
 */
export function headlineOf(records: PriceRecord[], unitId: string, kind: PriceKind): PriceRecord | null {
  return latestOf(records, unitId, kind, 'actual') ?? latestOf(records, unitId, kind)
}

export interface Change {
  prev: PriceRecord
  diffWon: number
  ratePct: number
}

/** 같은 시계열 안에서 바로 이전 기록 대비 변동 */
export function changeFromPrevious(records: PriceRecord[], target: PriceRecord): Change | null {
  const series = seriesOf(records, target.unitId, target.kind, target.priceType)
  const idx = series.findIndex((r) => r.id === target.id)
  if (idx <= 0) return null
  return diff(series[idx - 1], target)
}

export function diff(prev: PriceRecord, cur: PriceRecord): Change {
  const diffWon = cur.amountWon - prev.amountWon
  return { prev, diffWon, ratePct: (diffWon / prev.amountWon) * 100 }
}

/** 전세가율(%) = 전세 / 매매 × 100 */
export function jeonseRatio(saleWon: number | null | undefined, jeonseWon: number | null | undefined): number | null {
  if (saleWon == null || jeonseWon == null || saleWon <= 0) return null
  return (jeonseWon / saleWon) * 100
}

/** 매매·전세 기준일 차이가 이 일수를 넘으면 전세가율 옆에 경고를 띄운다 */
export const RATIO_DATE_GAP_WARN_DAYS = 90

export interface RatioNow {
  ratio: number | null
  sale: PriceRecord | null
  jeonse: PriceRecord | null
  gapDays: number | null
}

/** 단지·면적의 현재 전세가율: 각 종류의 대표 가격 사용, 기준일 차이도 함께 반환 */
export function currentRatio(records: PriceRecord[], unitId: string): RatioNow {
  const sale = headlineOf(records, unitId, 'sale')
  const jeonse = headlineOf(records, unitId, 'jeonse')
  const gapDays = sale && jeonse ? Math.abs(daysBetween(basisDate(sale), basisDate(jeonse))) : null
  return { ratio: jeonseRatio(sale?.amountWon, jeonse?.amountWon), sale, jeonse, gapDays }
}

export interface RatioPoint {
  date: ISODate
  ratio: number
  priceType: PriceType
}

/**
 * 전세가율 추이: 같은 입력(entryId)으로 함께 저장된 매매·전세 쌍,
 * entryId가 없으면 같은 조사일·같은 가격 유형 쌍만 사용한다.
 */
export function ratioHistory(records: PriceRecord[], unitId: string): RatioPoint[] {
  const groups = new Map<string, { sale?: PriceRecord; jeonse?: PriceRecord }>()
  for (const r of records) {
    if (r.unitId !== unitId) continue
    const key = r.entryId ?? `${r.surveyDate}|${r.priceType}`
    const g = groups.get(key) ?? {}
    const slot = g[r.kind]
    if (!slot || slot.createdAt < r.createdAt) g[r.kind] = r
    groups.set(key, g)
  }
  const points: RatioPoint[] = []
  for (const g of groups.values()) {
    if (!g.sale || !g.jeonse || g.sale.priceType !== g.jeonse.priceType) continue
    const ratio = jeonseRatio(g.sale.amountWon, g.jeonse.amountWon)
    if (ratio == null) continue
    const date = [basisDate(g.sale), basisDate(g.jeonse)].sort().at(-1)!
    points.push({ date, ratio, priceType: g.sale.priceType })
  }
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** 기간 비교 시 과거 기록을 찾을 허용 오차(일) */
export const PERIOD_TOLERANCE_DAYS = 45

/**
 * N개월 변화: 시계열 최신 기록과, 그보다 N개월 전 시점에 가장 가까운 기록 비교.
 * 가까운 기록이 허용 오차 밖이면 null (억지로 계산하지 않는다).
 */
export function periodChange(series: PriceRecord[], months: number): Change | null {
  const sorted = sortByBasis(series)
  const latest = sorted.at(-1)
  if (!latest) return null
  const target = addMonths(basisDate(latest), -months)
  let best: PriceRecord | null = null
  let bestGap = Infinity
  for (const r of sorted) {
    if (r.id === latest.id) continue
    const gap = Math.abs(daysBetween(basisDate(r), target))
    if (gap < bestGap) {
      best = r
      bestGap = gap
    }
  }
  if (!best || bestGap > PERIOD_TOLERANCE_DAYS) return null
  return diff(best, latest)
}

export function extremes(series: PriceRecord[]): { max: PriceRecord; min: PriceRecord } | null {
  if (series.length === 0) return null
  let max = series[0]
  let min = series[0]
  for (const r of series) {
    if (r.amountWon > max.amountWon) max = r
    if (r.amountWon < min.amountWon) min = r
  }
  return { max, min }
}

/** 가져오기 중복 판정 키 */
export function priceDedupeKey(r: Pick<PriceRecord, 'unitId' | 'kind' | 'amountWon' | 'dealDate' | 'surveyDate' | 'priceType'>): string {
  return [r.unitId, r.kind, r.amountWon, r.dealDate ?? '', r.surveyDate, r.priceType].join('|')
}
