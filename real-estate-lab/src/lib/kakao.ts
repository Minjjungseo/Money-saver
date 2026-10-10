/**
 * 카카오맵 JavaScript SDK 연결.
 * - 키는 브라우저 localStorage(또는 .env.local 의 VITE_KAKAO_JS_KEY)에만 둔다. 백업 파일·코드 저장소에는 넣지 않는다.
 * - 카카오 개발자 콘솔에서 이 앱 주소(예: http://localhost:5173)를 Web 플랫폼 도메인으로 등록해야 지도가 열린다.
 */
import type { PlaceCandidate } from './geo'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any
  }
}

const KEY_STORAGE = 'mrel:kakaoJsKey'

export function getKakaoKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) || ''
  } catch {
    return memoryKey || (import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) || ''
  }
}

export function setKakaoKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim())
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* 저장소를 쓸 수 없는 환경: 이번 창에서만 사용 */
    memoryKey = key.trim()
  }
  loading = null
}

let memoryKey = ''

let loading: Promise<any> | null = null

export const KAKAO_SETUP_HINT =
  '카카오 개발자 콘솔 → 내 애플리케이션 → 앱 설정 → 플랫폼 → Web 사이트 도메인에 지금 주소(예: http://localhost:5173)를 등록했는지, ' +
  '제품 설정에서 카카오맵 사용이 켜져 있는지, JavaScript 키를 붙여 넣었는지 확인하세요.'

/** SDK를 한 번만 불러온다 (services: 장소·주소 검색) */
export function loadKakao(key = getKakaoKey()): Promise<any> {
  if (!key) return Promise.reject(new Error('카카오 JavaScript 키가 없습니다'))
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao)
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      loading = null
      reject(new Error(`카카오맵을 10초 안에 불러오지 못했습니다. ${KAKAO_SETUP_HINT}`))
    }, 10_000)
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`
    script.async = true
    script.onload = () => {
      if (!window.kakao?.maps) {
        window.clearTimeout(timer)
        loading = null
        reject(new Error(`카카오맵 SDK가 응답하지 않았습니다. ${KAKAO_SETUP_HINT}`))
        return
      }
      window.kakao.maps.load(() => {
        window.clearTimeout(timer)
        resolve(window.kakao)
      })
    }
    script.onerror = () => {
      window.clearTimeout(timer)
      loading = null
      script.remove()
      reject(new Error(`카카오맵 스크립트를 불러오지 못했습니다(키 또는 도메인 오류). ${KAKAO_SETUP_HINT}`))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** 키워드(단지명) 장소 검색 → 후보 목록 */
export async function searchPlaces(query: string): Promise<PlaceCandidate[]> {
  const kakao = await loadKakao()
  const ps = new kakao.maps.services.Places()
  return new Promise((resolve, reject) => {
    ps.keywordSearch(query, (data: any[], status: string) => {
      const S = kakao.maps.services.Status
      if (status === S.OK) {
        resolve(
          data.map((d) => ({
            name: d.place_name,
            address: d.address_name,
            roadAddress: d.road_address_name || null,
            category: d.category_name || '',
            lat: Number(d.y),
            lng: Number(d.x),
          })),
        )
      } else if (status === S.ZERO_RESULT) resolve([])
      else reject(new Error('장소 검색에 실패했습니다'))
    })
  })
}

/** 주소 → 좌표 후보 */
export async function searchAddress(address: string): Promise<PlaceCandidate[]> {
  const kakao = await loadKakao()
  const geocoder = new kakao.maps.services.Geocoder()
  return new Promise((resolve, reject) => {
    geocoder.addressSearch(address, (data: any[], status: string) => {
      const S = kakao.maps.services.Status
      if (status === S.OK) {
        resolve(
          data.map((d) => ({
            name: d.road_address?.building_name || d.address_name,
            address: d.address?.address_name || d.address_name,
            roadAddress: d.road_address?.address_name || null,
            category: '주소',
            lat: Number(d.y),
            lng: Number(d.x),
          })),
        )
      } else if (status === S.ZERO_RESULT) resolve([])
      else reject(new Error('주소 검색에 실패했습니다'))
    })
  })
}
