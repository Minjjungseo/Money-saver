import type { Apartment, ApartmentUnit, AppData, ID, PriceRecord, Region } from '@/store/schema'
import { basisDate, changeFromPrevious, currentRatio, type Change } from './calc'

export function regionById(d: AppData): Map<ID, Region> {
  return new Map(d.regions.map((r) => [r.id, r]))
}

/** "서울 강남구" 형태의 전체 이름 */
export function regionPath(d: AppData, regionId: ID): string {
  const map = regionById(d)
  const parts: string[] = []
  let cur = map.get(regionId)
  while (cur) {
    parts.unshift(cur.name)
    cur = cur.parentId ? map.get(cur.parentId) : undefined
  }
  return parts.join(' ')
}

/** 해당 지역과 모든 하위 지역 id */
export function descendantIds(d: AppData, regionId: ID): Set<ID> {
  const out = new Set<ID>([regionId])
  let added = true
  while (added) {
    added = false
    for (const r of d.regions) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id)
        added = true
      }
    }
  }
  return out
}

export function unitsOf(d: AppData, apartmentId: ID): ApartmentUnit[] {
  return d.units.filter((u) => u.apartmentId === apartmentId).sort((a, b) => a.exclusiveArea - b.exclusiveArea)
}

/** 대표 면적: 기록이 가장 많은 면적 (동률이면 작은 면적) */
export function primaryUnit(d: AppData, apartmentId: ID): ApartmentUnit | null {
  const units = unitsOf(d, apartmentId)
  if (units.length === 0) return null
  const count = (u: ApartmentUnit) => d.prices.filter((p) => p.unitId === u.id).length
  return units.reduce((best, u) => (count(u) > count(best) ? u : best), units[0])
}

export interface AptSummary {
  apartment: Apartment
  unit: ApartmentUnit | null
  sale: PriceRecord | null
  jeonse: PriceRecord | null
  ratio: number | null
  ratioGapDays: number | null
  saleChange: Change | null
  lastSurvey: string | null
  recordCount: number
}

export function summarize(d: AppData, apartment: Apartment, unitId?: ID): AptSummary {
  const unit = unitId ? (d.units.find((u) => u.id === unitId) ?? null) : primaryUnit(d, apartment.id)
  if (!unit) {
    return { apartment, unit: null, sale: null, jeonse: null, ratio: null, ratioGapDays: null, saleChange: null, lastSurvey: null, recordCount: 0 }
  }
  const prices = d.prices.filter((p) => p.unitId === unit.id)
  const r = currentRatio(prices, unit.id)
  const sale = r.sale
  return {
    apartment,
    unit,
    sale,
    jeonse: r.jeonse,
    ratio: r.ratio,
    ratioGapDays: r.gapDays,
    saleChange: sale ? changeFromPrevious(prices, sale) : null,
    lastSurvey: prices.map((p) => p.surveyDate).sort().at(-1) ?? null,
    recordCount: prices.length,
  }
}

export function lastUpdated(d: AppData): string | null {
  return d.prices.map((p) => p.surveyDate).sort().at(-1) ?? null
}

/** 최근 입력 순 (입력 시각 기준) */
export function recentPrices(d: AppData, limit: number): PriceRecord[] {
  return [...d.prices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
}

export function describePrice(d: AppData, p: PriceRecord): { apartment: Apartment | null; unit: ApartmentUnit | null } {
  const unit = d.units.find((u) => u.id === p.unitId) ?? null
  const apartment = unit ? (d.apartments.find((a) => a.id === unit.apartmentId) ?? null) : null
  return { apartment, unit }
}

export function unitLabel(u: ApartmentUnit | null): string {
  if (!u) return '—'
  return `전용 ${u.exclusiveArea}㎡${u.label ? ` (${u.label})` : ''}`
}

export { basisDate }
