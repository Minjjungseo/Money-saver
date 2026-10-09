/**
 * 데이터 변경 함수 모음. 모두 순수 함수(AppData → 새 AppData)라서 테스트하기 쉽다.
 */
import { priceDedupeKey } from '@/lib/calc'
import { newId, nowStamp } from '@/lib/id'
import type { Apartment, ApartmentUnit, AppData, ID, ISODate, PriceKind, PriceRecord, PriceType, Region, RegionType } from './schema'

// ---------- 지역 ----------

export function addRegion(d: AppData, parentId: ID, name: string, type: RegionType): { data: AppData; region: Region } {
  const parent = d.regions.find((r) => r.id === parentId)
  if (!parent) throw new Error('상위 지역을 찾을 수 없습니다')
  const id = `${parent.id}/${name.trim()}`
  const existing = d.regions.find((r) => r.id === id)
  if (existing) return { data: d, region: existing }
  const region: Region = { id, parentId, name: name.trim(), type, adminCode: null, group: parent.group, custom: true }
  return { data: { ...d, regions: [...d.regions, region] }, region }
}

/**
 * "경기" + ["성남시", "분당구"] 처럼 경로로 지역을 찾고, 없는 단계는 만든다.
 * 첫 단계는 시·군·구, 그 아래는 일반구.
 */
export function ensureRegionPath(d: AppData, sidoId: ID, parts: string[]): { data: AppData; regionId: ID; created: number } {
  let data = d
  let regionId = sidoId
  let created = 0
  parts.forEach((name, i) => {
    const before = data.regions.length
    const res = addRegion(data, regionId, name, i === 0 ? 'sigungu' : 'gu')
    data = res.data
    regionId = res.region.id
    created += data.regions.length - before
  })
  return { data, regionId, created }
}

// ---------- 단지 ----------

export type ApartmentInput = Pick<Apartment, 'regionId' | 'name' | 'address' | 'builtYear' | 'households' | 'isLandmark' | 'memo'>

export function addApartment(d: AppData, input: ApartmentInput, isSample = false): { data: AppData; apartment: Apartment } {
  const t = nowStamp()
  const apartment: Apartment = { id: newId('apt'), ...input, name: input.name.trim(), isSample, createdAt: t, updatedAt: t }
  return { data: { ...d, apartments: [...d.apartments, apartment] }, apartment }
}

export function updateApartment(d: AppData, id: ID, patch: Partial<ApartmentInput>): AppData {
  return {
    ...d,
    apartments: d.apartments.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: nowStamp() } : a)),
  }
}

/** 단지와 그 단지의 모든 면적·가격 기록을 함께 삭제 */
export function deleteApartment(d: AppData, id: ID): AppData {
  const unitIds = new Set(d.units.filter((u) => u.apartmentId === id).map((u) => u.id))
  return {
    ...d,
    apartments: d.apartments.filter((a) => a.id !== id),
    units: d.units.filter((u) => !unitIds.has(u.id)),
    prices: d.prices.filter((p) => !unitIds.has(p.unitId)),
    notes: d.notes.map((n) => (n.apartmentId === id ? { ...n, apartmentId: null } : n)),
  }
}

// ---------- 면적 ----------

export function normalizeArea(area: number): number {
  return Math.round(area * 100) / 100
}

function sameLabel(a: string | null, b: string | null): boolean {
  return (a ?? '').trim().toUpperCase() === (b ?? '').trim().toUpperCase()
}

/**
 * 면적 지정 방법
 * - 전용면적(area)이 있으면 전용면적 + 타입으로 찾는다.
 * - 전용면적이 없고 평형만 있으면, 전용면적 미확인 상태의 같은 평형 + 타입으로 찾는다.
 */
export interface UnitSpec {
  area: number | null
  pyeong?: number | null
  label: string | null
}

export function findUnit(d: AppData, apartmentId: ID, spec: UnitSpec): ApartmentUnit | undefined {
  const area = spec.area == null ? null : normalizeArea(spec.area)
  const pyeong = spec.pyeong ?? null
  return d.units.find(
    (u) =>
      u.apartmentId === apartmentId &&
      sameLabel(u.label, spec.label) &&
      (area != null ? u.exclusiveArea === area : u.exclusiveArea == null && (u.pyeong ?? null) === pyeong),
  )
}

export function findOrCreateUnit(d: AppData, apartmentId: ID, spec: UnitSpec, isSample = false): { data: AppData; unit: ApartmentUnit } {
  const found = findUnit(d, apartmentId, spec)
  if (found) return { data: d, unit: found }
  const unit: ApartmentUnit = {
    id: newId('unit'),
    apartmentId,
    exclusiveArea: spec.area == null ? null : normalizeArea(spec.area),
    pyeong: spec.pyeong ?? null,
    label: spec.label?.trim() ? spec.label.trim() : null,
    isSample,
  }
  return { data: { ...d, units: [...d.units, unit] }, unit }
}

/** 면적 정보 수정 (예: 평형만 있던 면적에 확인한 전용면적 입력) */
export function updateUnit(d: AppData, id: ID, patch: Partial<Pick<ApartmentUnit, 'exclusiveArea' | 'pyeong' | 'label'>>): AppData {
  const next = { ...patch }
  if (next.exclusiveArea != null) next.exclusiveArea = normalizeArea(next.exclusiveArea)
  return { ...d, units: d.units.map((u) => (u.id === id ? { ...u, ...next } : u)) }
}

// ---------- 가격 ----------

export interface PricePart {
  amountWon: number
  dealDate: ISODate | null
}

export interface PriceEntryInput {
  unitId: ID
  surveyDate: ISODate
  priceType: PriceType
  sourceUrl: string | null
  memo: string | null
  sale: PricePart | null
  jeonse: PricePart | null
  legacy?: boolean
  isSample?: boolean
}

export interface EntryResult {
  data: AppData
  created: PriceRecord[]
  /** 이미 똑같은 기록이 있어 건너뛴 종류 */
  skipped: PriceKind[]
}

/** 매매·전세를 한 번에 입력. 각자 다른 거래일을 가질 수 있다. */
export function addPriceEntry(d: AppData, input: PriceEntryInput): EntryResult {
  const t = nowStamp()
  const entryId = newId('entry')
  const existing = new Set(d.prices.map(priceDedupeKey))
  const created: PriceRecord[] = []
  const skipped: PriceKind[] = []
  for (const kind of ['sale', 'jeonse'] as const) {
    const part = input[kind]
    if (!part) continue
    const rec: PriceRecord = {
      id: newId('price'),
      unitId: input.unitId,
      kind,
      amountWon: part.amountWon,
      dealDate: part.dealDate,
      surveyDate: input.surveyDate,
      priceType: input.priceType,
      sourceUrl: input.sourceUrl,
      memo: input.memo,
      entryId,
      legacy: input.legacy ?? false,
      isSample: input.isSample ?? false,
      createdAt: t,
      updatedAt: t,
    }
    const key = priceDedupeKey(rec)
    if (existing.has(key)) {
      skipped.push(kind)
      continue
    }
    existing.add(key)
    created.push(rec)
  }
  return { data: created.length ? { ...d, prices: [...d.prices, ...created] } : d, created, skipped }
}

export type PricePatch = Partial<Pick<PriceRecord, 'amountWon' | 'dealDate' | 'surveyDate' | 'priceType' | 'sourceUrl' | 'memo' | 'legacy'>>

export function updatePrice(d: AppData, id: ID, patch: PricePatch): AppData {
  return { ...d, prices: d.prices.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: nowStamp() } : p)) }
}

export function deletePrice(d: AppData, id: ID): AppData {
  return { ...d, prices: d.prices.filter((p) => p.id !== id) }
}

// ---------- 예시 데이터 ----------

export function hasSample(d: AppData): boolean {
  return d.apartments.some((a) => a.isSample) || d.prices.some((p) => p.isSample)
}

/**
 * 예시 데이터만 지운다. 예시 단지에 사용자가 직접 넣은 실제 가격이 있으면
 * 그 단지·면적은 남겨 둔다(사용자 데이터 보호).
 */
export function removeSample(d: AppData): AppData {
  const prices = d.prices.filter((p) => !p.isSample)
  const usedUnits = new Set(prices.map((p) => p.unitId))
  const units = d.units.filter((u) => !u.isSample || usedUnits.has(u.id))
  const usedApts = new Set(units.map((u) => u.apartmentId))
  const apartments = d.apartments.filter((a) => !a.isSample || usedApts.has(a.id))
  return { ...d, prices, units, apartments }
}

// ---------- 설정 ----------

export function setTodayMemo(d: AppData, date: ISODate, text: string): AppData {
  return { ...d, settings: { ...d.settings, todayMemo: text.trim() ? { date, text } : null } }
}

export function setWeeklyFocus(d: AppData, regionIds: ID[]): AppData {
  return { ...d, settings: { ...d.settings, weeklyFocusRegionIds: regionIds } }
}
