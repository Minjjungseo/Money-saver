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
  /** 입지 메모: 교통 / 학군 / 생활 인프라 (직접 확인한 내용) */
  transitMemo: string | null
  schoolMemo: string | null
  infraMemo: string | null
  /** 지도 위치. 카카오 검색 결과에서 직접 고르거나 직접 입력한 경우에만 있다. 모르면 null */
  location: ApartmentLocation | null
  isSample: boolean
  createdAt: string
  updatedAt: string
}

export type LocationSource = 'kakao-place' | 'kakao-address' | 'manual'

export interface ApartmentLocation {
  lat: number
  lng: number
  source: LocationSource
  /** 위치를 고를 때 본 장소명·주소 (검증 기록) */
  matchedName: string | null
  matchedAddress: string | null
  setAt: string
}

export interface ApartmentUnit {
  id: ID
  apartmentId: ID
  /** 전용면적(㎡). 기존 시트처럼 평형만 알고 전용면적을 모르면 null */
  exclusiveArea: number | null
  /** 평형(공급면적 기준, 예: 34). 원본 자료에 평형만 있을 때 보존용 */
  pyeong: number | null
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

/**
 * 생활권: 행정구역과 별개로 사용자가 직접 묶는 단지 그룹 (예: "판교 생활권", "목동 학군지")
 * 한 단지가 여러 생활권에 들어갈 수 있다.
 */
export interface LivingArea {
  id: ID
  name: string
  description: string | null
  apartmentIds: ID[]
  /** 생활권 대표 단지 (apartmentIds 중 하나) */
  representativeId: ID | null
  createdAt: string
  updatedAt: string
}

export type CandidateStatus = 'studying' | 'verified' | 'dropped'

/** 비교 대상: 단지 + 비교할 면적 */
export interface UnitRef {
  apartmentId: ID
  unitId: ID | null
}

/**
 * 저평가 후보 탐색 노트.
 * 앱은 가격 차이 같은 사실만 계산하고, '저평가'라는 판단은 사용자가 쓴 가설로만 남긴다.
 */
export interface Candidate {
  id: ID
  target: UnitRef
  comparisons: UnitRef[]
  /** 내가 세운 저평가 가설 */
  hypothesis: string
  /** 확인할 근거 (한 줄에 하나) */
  evidenceToCheck: string
  /** 비교 대상과의 차이 (직접 기록) */
  locationDiff: string | null
  ageDiff: string | null
  areaDiff: string | null
  volumeDiff: string | null
  status: CandidateStatus
  /** 확인 결과·결론 */
  conclusion: string | null
  createdAt: string
  updatedAt: string
}

export interface Settings {
  weeklyFocusRegionIds: ID[]
  todayMemo: { date: ISODate; text: string } | null
  /** 랜드마크 비교 목록 (지도·목록·상세에서 추가) */
  compare: UnitRef[]
}

export interface AppData {
  schemaVersion: number
  regions: Region[]
  apartments: Apartment[]
  units: ApartmentUnit[]
  prices: PriceRecord[]
  notes: StudyNote[]
  livingAreas: LivingArea[]
  candidates: Candidate[]
  settings: Settings
}

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = { studying: '검토 중', verified: '근거 확인됨', dropped: '보류·기각' }
export const LOCATION_SOURCE_LABEL: Record<LocationSource, string> = { 'kakao-place': '카카오 장소 검색', 'kakao-address': '카카오 주소 검색', manual: '직접 입력' }
export const PRICE_KIND_LABEL: Record<PriceKind, string> = { sale: '매매', jeonse: '전세' }
export const PRICE_TYPE_LABEL: Record<PriceType, string> = { actual: '실거래가', asking: '호가', other: '기타' }
export const REGION_GROUP_LABEL: Record<RegionGroup, string> = { capital: '수도권', metro: '광역시', local: '중소도시' }
export const REGION_TYPE_LABEL: Record<RegionType, string> = { sido: '시·도', sigungu: '시·군·구', gu: '일반구' }
