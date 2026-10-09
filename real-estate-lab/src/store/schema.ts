/**
 * MY REAL ESTATE LAB 데이터 모델
 *
 * 원칙
 * - 금액은 원(₩) 단위 정수로 저장한다. 화면에서만 억 원으로 바꾼다.
 * - 값이 없으면 0이 아니라 null.
 * - 전세가율·변동률은 저장하지 않는다. 항상 원본 가격에서 계산한다.
 * - 엔터티는 Supabase 테이블로 그대로 옮길 수 있게 평평한 구조 + id 참조로 둔다.
 */

export const SCHEMA_VERSION = 1

export type ID = string
/** YYYY-MM-DD */
export type ISODate = string

/** sido = 시·도, sigungu = 시·군·구, gu = 일반구(예: 수원시 영통구) */
export type RegionType = 'sido' | 'sigungu' | 'gu'

/** 수도권 / 광역시 / 중소도시 — 기존 시트의 탭 구분을 그대로 따른다 */
export type RegionGroup = 'capital' | 'metro' | 'local'

export interface Region {
  id: ID
  parentId: ID | null
  name: string
  type: RegionType
  /** 행정표준코드(시도 2자리 / 시군구 5자리). 모르면 null */
  adminCode: string | null
  group: RegionGroup
  /** 사용자가 직접 추가한 지역이면 true */
  custom?: boolean
}

export interface Apartment {
  id: ID
  regionId: ID
  name: string
  address: string | null
  builtYear: number | null
  households: number | null
  /** 지역 대표(랜드마크) 단지 여부 */
  isLandmark: boolean
  memo: string | null
  isSample: boolean
  createdAt: string
  updatedAt: string
}

export interface ApartmentUnit {
  id: ID
  apartmentId: ID
  /** 전용면적(㎡) */
  exclusiveArea: number
  /** 면적 식별자(예: 84A, 59B). 없으면 null */
  label: string | null
  isSample: boolean
}

export type PriceKind = 'sale' | 'jeonse'
export type PriceType = 'actual' | 'asking' | 'other'

export interface PriceRecord {
  id: ID
  unitId: ID
  kind: PriceKind
  /** 원 단위 정수 */
  amountWon: number
  /** 거래일 또는 가격 기준일. 모르면 null(이때는 조사일을 기준일로 본다) */
  dealDate: ISODate | null
  /** 내가 이 가격을 조사·확인한 날 */
  surveyDate: ISODate
  priceType: PriceType
  sourceUrl: string | null
  memo: string | null
  /** 같은 입력 화면에서 함께 저장된 매매·전세를 묶는 id */
  entryId: ID | null
  /** 기존 시트 등에서 가져온 과거 자료(기준 불명확 가능) */
  legacy: boolean
  isSample: boolean
  createdAt: string
  updatedAt: string
}

export interface StudyNote {
  id: ID
  date: ISODate
  regionId: ID | null
  apartmentId: ID | null
  title: string
  content: string
  source: string | null
  createdAt: string
  updatedAt: string
}

export interface Settings {
  weeklyFocusRegionIds: ID[]
  todayMemo: { date: ISODate; text: string } | null
}

export interface AppData {
  schemaVersion: number
  regions: Region[]
  apartments: Apartment[]
  units: ApartmentUnit[]
  prices: PriceRecord[]
  notes: StudyNote[]
  settings: Settings
}

export const PRICE_KIND_LABEL: Record<PriceKind, string> = { sale: '매매', jeonse: '전세' }
export const PRICE_TYPE_LABEL: Record<PriceType, string> = { actual: '실거래가', asking: '호가', other: '기타' }
export const REGION_GROUP_LABEL: Record<RegionGroup, string> = { capital: '수도권', metro: '광역시', local: '중소도시' }
export const REGION_TYPE_LABEL: Record<RegionType, string> = { sido: '시·도', sigungu: '시·군·구', gu: '일반구' }
