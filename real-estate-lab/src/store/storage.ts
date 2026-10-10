import { buildDefaultRegions } from '@/data/regions'
import { SCHEMA_VERSION, type AppData } from './schema'

export const STORAGE_KEY = 'mrel:data:v1'
/** 가져오기·예시 데이터 삭제 직전 상태 (되돌리기용) */
export const UNDO_KEY = 'mrel:undo:v1'

export function emptyData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    regions: buildDefaultRegions(),
    apartments: [],
    units: [],
    prices: [],
    notes: [],
    livingAreas: [],
    candidates: [],
    settings: { weeklyFocusRegionIds: [], todayMemo: null, compare: [] },
  }
}

/**
 * 저장된 데이터를 현재 스키마로 맞춘다.
 * 기존 기록은 절대 지우지 않고, 빠진 필드와 새 기본 지역만 보충한다.
 */
export function normalize(raw: Partial<AppData>): AppData {
  const base = emptyData()
  const regions = Array.isArray(raw.regions) ? [...raw.regions] : []
  const known = new Set(regions.map((r) => r.id))
  for (const r of base.regions) if (!known.has(r.id)) regions.push(r)
  return {
    schemaVersion: SCHEMA_VERSION,
    regions,
    apartments: Array.isArray(raw.apartments)
      ? raw.apartments.map((a) => ({ ...a, transitMemo: a.transitMemo ?? null, schoolMemo: a.schoolMemo ?? null, infraMemo: a.infraMemo ?? null, location: a.location ?? null }))
      : [],
    units: Array.isArray(raw.units) ? raw.units.map((u) => ({ ...u, pyeong: u.pyeong ?? null })) : [],
    prices: Array.isArray(raw.prices) ? raw.prices : [],
    notes: Array.isArray(raw.notes) ? raw.notes : [],
    livingAreas: Array.isArray(raw.livingAreas) ? raw.livingAreas : [],
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    settings: {
      weeklyFocusRegionIds: raw.settings?.weeklyFocusRegionIds ?? [],
      todayMemo: raw.settings?.todayMemo ?? null,
      compare: Array.isArray(raw.settings?.compare) ? raw.settings.compare : [],
    },
  }
}

export interface LoadResult {
  data: AppData
  /** 저장된 값을 읽지 못했을 때의 안내. 원본은 별도 키에 보관된다. */
  warning: string | null
}

/**
 * 브라우저 저장소를 안전하게 얻는다. 미리보기 창(샌드박스)처럼 저장소 접근 자체가 막힌 환경에서는 null.
 * localStorage 에 접근만 해도 예외가 나는 환경이 있어 반드시 이 함수를 거친다.
 */
export function getStorage(): Storage | null {
  try {
    const s = globalThis.localStorage
    if (!s) return null
    const probe = '__mrel_probe__'
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export function loadData(storage: Storage | null = getStorage()): LoadResult {
  if (!storage) return { data: emptyData(), warning: null }
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { data: emptyData(), warning: '브라우저 저장소를 읽지 못했습니다.' }
  }
  if (raw == null) return { data: emptyData(), warning: null }
  try {
    return { data: normalize(JSON.parse(raw)), warning: null }
  } catch {
    // 손상된 원본을 덮어쓰지 않도록 다른 키로 옮겨 둔다
    const keep = `mrel:corrupt:${Date.now()}`
    try {
      storage.setItem(keep, raw)
    } catch {
      /* 보관 실패해도 원본 키는 그대로 남아 있다 (아래에서 덮어쓰지 않음) */
    }
    return {
      data: emptyData(),
      warning: `저장된 데이터를 읽지 못했습니다. 원본은 브라우저 저장소의 "${keep}" 키에 보관했습니다.`,
    }
  }
}

/** 저장. 실패하면 예외를 던진다 (호출하는 쪽에서 화면 상태를 바꾸지 않도록) */
export function saveData(data: AppData, storage: Storage | null = getStorage()): void {
  if (!storage) throw new Error('브라우저 저장소를 쓸 수 없습니다')
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function saveUndo(data: AppData, label: string, storage: Storage | null = getStorage()): void {
  try {
    storage?.setItem(UNDO_KEY, JSON.stringify({ label, at: new Date().toISOString(), data }))
  } catch {
    // 용량 부족 등으로 실패해도 본 작업은 진행 (되돌리기만 불가)
  }
}

export function readUndo(storage: Storage | null = getStorage()): { label: string; at: string; data: AppData } | null {
  try {
    const raw = storage?.getItem(UNDO_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return { label: v.label, at: v.at, data: normalize(v.data) }
  } catch {
    return null
  }
}

export function clearUndo(storage: Storage | null = getStorage()): void {
  try {
    storage?.removeItem(UNDO_KEY)
  } catch {
    /* 무시 */
  }
}

/** 저장된 데이터 크기(바이트, 대략). 읽을 수 없으면 0 */
export function storedBytes(storage: Storage | null = getStorage()): number {
  try {
    return (storage?.getItem(STORAGE_KEY) ?? '').length * 2
  } catch {
    return 0
  }
}
