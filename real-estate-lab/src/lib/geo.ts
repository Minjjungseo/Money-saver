/**
 * 지도용 순수 계산: 좌표 검증, 장소 후보 일치도, 생활권 외곽선(볼록 껍질), 가격 구간 색.
 */

/** 대한민국 대략 범위 (제주·울릉 포함). 밖이면 입력 실수로 본다 */
export function isInKorea(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33 && lat <= 38.7 && lng >= 124.5 && lng <= 131.9
}

export function parseCoord(latText: string, lngText: string): { ok: true; lat: number; lng: number } | { ok: false; error: string } {
  const lat = Number(latText.trim())
  const lng = Number(lngText.trim())
  if (!latText.trim() || !lngText.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, error: '위도·경도를 숫자로 입력하세요 (예: 37.5112, 127.0981)' }
  if (!isInKorea(lat, lng)) return { ok: false, error: '대한민국 범위를 벗어난 좌표입니다. 위도·경도 순서를 확인하세요' }
  return { ok: true, lat, lng }
}

export interface PlaceCandidate {
  name: string
  address: string
  roadAddress: string | null
  category: string
  lat: number
  lng: number
}

const squash = (s: string) => s.replace(/[\\s()·.,-]/g, '').toLowerCase()

/**
 * 장소 후보가 단지와 같은 곳일 가능성 (0~3). 자동 확정에는 쓰지 않고, 확인 목록의 기본 체크 여부에만 쓴다.
 * +1 이름 포함, +1 아파트 분류, +1 주소에 시·군·구 이름 포함
 */
export function matchScore(aptName: string, regionNames: string[], c: PlaceCandidate): number {
  let s = 0
  const n = squash(aptName)
  const p = squash(c.name)
  if (n && (p.includes(n) || n.includes(p))) s++
  if (c.category.includes('아파트')) s++
  const addr = `${c.address} ${c.roadAddress ?? ''}`
  const local = regionNames.slice(1)
  if (local.length === 0 ? addr.includes(regionNames[0] ?? '') : local.some((r) => addr.includes(r.replace(/(시|군|구)$/, '')))) s++
  return s
}

/** 볼록 껍질 (Andrew monotone chain). 점이 3개 미만이면 빈 배열 */
export function convexHull<T extends { lat: number; lng: number }>(points: T[]): T[] {
  const pts = [...points].sort((a, b) => a.lng - b.lng || a.lat - b.lat)
  if (pts.length < 3) return []
  const cross = (o: T, a: T, b: T) => (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng)
  const lower: T[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: T[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1))
  return hull.length >= 3 ? hull : []
}

/** 가격 구간 색: 한 가지 색(네이비)의 밝기 단계. 비쌀수록 진하게 */
export const PRICE_STEPS: { maxEok: number; color: string; text: string; label: string }[] = [
  { maxEok: 5, color: '#dbe7f7', text: '#1e293b', label: '5억 미만' },
  { maxEok: 10, color: '#a9c6ec', text: '#1e293b', label: '5~10억' },
  { maxEok: 15, color: '#6f9fdc', text: '#ffffff', label: '10~15억' },
  { maxEok: 20, color: '#3d74c4', text: '#ffffff', label: '15~20억' },
  { maxEok: 30, color: '#1f4f9a', text: '#ffffff', label: '20~30억' },
  { maxEok: Infinity, color: '#0f2d5c', text: '#ffffff', label: '30억 이상' },
]
export const NO_PRICE_STYLE = { color: '#ffffff', text: '#64748b', label: '가격 없음' }

export function priceStep(won: number | null) {
  if (won == null) return NO_PRICE_STYLE
  const eok = won / 100_000_000
  return PRICE_STEPS.find((s) => eok < s.maxEok)!
}
