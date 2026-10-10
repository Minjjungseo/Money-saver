/**
 * 국토교통부 실거래가 API 공통 모듈 (Node 18 이상 내장 기능만 사용, 추가 설치 없음)
 *
 * - 인증키는 real-estate-lab/.env.local 의 MOLIT_SERVICE_KEY 에서만 읽는다. 브라우저로 보내지 않는다.
 * - 매매: RTMSDataSvcAptTrade / 전월세: RTMSDataSvcAptRent (공공데이터포털 15126469, 15126474)
 * - 응답 항목명은 신규(aptNm, excluUseAr…)와 예전 한글(아파트, 전용면적…) 모두 받아들인다.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// MOLIT_API_BASE 는 자동 테스트에서 가짜 서버를 가리킬 때만 쓴다 (평소에는 비워 둠)
const BASE = process.env.MOLIT_API_BASE ?? 'https://apis.data.go.kr/1613000'
export const ENDPOINTS = {
  sale: `${BASE}/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade`,
  rent: `${BASE}/RTMSDataSvcAptRent/getRTMSDataSvcAptRent`,
}

/** .env.local 에서 키를 읽는다. 인코딩 키(%2B 등 포함)를 넣어도 디코딩해서 쓴다. */
export function loadServiceKey() {
  const file = join(ROOT, '.env.local')
  let key = process.env.MOLIT_SERVICE_KEY ?? ''
  if (!key && existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = /^\s*MOLIT_SERVICE_KEY\s*=\s*(.*)\s*$/.exec(line)
      if (m) key = m[1].replace(/^["']|["']$/g, '').trim()
    }
  }
  if (!key) {
    throw new Error(
      `인증키가 없습니다. ${file} 파일을 만들고 한 줄로 MOLIT_SERVICE_KEY=발급받은키 를 적어 주세요.\n` +
        '(공공데이터포털 → 마이페이지 → 활용신청 현황 → 일반 인증키(Decoding) 권장)',
    )
  }
  if (/%[0-9A-Fa-f]{2}/.test(key)) {
    try {
      key = decodeURIComponent(key)
    } catch {
      /* 그대로 사용 */
    }
  }
  return key
}

/** XML 한 덩어리에서 <tag>값</tag> 읽기 (응답이 단순한 평면 구조라 정규식으로 충분) */
function tag(xml, name) {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml)
  return m ? m[1].trim() : null
}

const pick = (obj, ...names) => {
  for (const n of names) if (obj[n] != null && obj[n] !== '') return obj[n]
  return null
}

/** '355,000' (만원) → 3_550_000_000 (원). 숫자가 아니면 null */
export function manwonToWon(v) {
  if (v == null) return null
  const n = Number(String(v).replace(/[,\s]/g, ''))
  return Number.isFinite(n) && n >= 0 ? Math.round(n) * 10_000 : null
}

const pad = (n) => String(n).padStart(2, '0')

/** API 응답(XML) → { ok, items, totalCount, error, raw } */
export function parseResponse(xml) {
  const authErr = tag(xml, 'returnAuthMsg') ?? tag(xml, 'errMsg')
  const resultCode = tag(xml, 'resultCode')
  const resultMsg = tag(xml, 'resultMsg')
  if (authErr && !/NORMAL/i.test(authErr)) return { ok: false, items: [], totalCount: 0, error: `${authErr} (${tag(xml, 'returnReasonCode') ?? ''})` }
  if (resultCode && !/^0+$/.test(resultCode)) return { ok: false, items: [], totalCount: 0, error: `${resultCode} ${resultMsg ?? ''}` }
  if (!/<response|<items/.test(xml)) return { ok: false, items: [], totalCount: 0, error: '알 수 없는 응답 형식' }
  const items = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const obj = {}
    for (const f of m[1].matchAll(/<([^/>\s]+)>([\s\S]*?)<\/\1>/g)) obj[f[1]] = f[2].trim()
    items.push(obj)
  }
  return { ok: true, items, totalCount: Number(tag(xml, 'totalCount') ?? items.length) }
}

/** 원본 항목 → 앱에서 쓰는 형태 */
export function normalizeItem(kind, o) {
  const y = pick(o, 'dealYear', '년')
  const mo = pick(o, 'dealMonth', '월')
  const d = pick(o, 'dealDay', '일')
  const area = Number(pick(o, 'excluUseAr', '전용면적'))
  const base = {
    kind,
    aptName: pick(o, 'aptNm', '아파트') ?? '',
    dong: pick(o, 'umdNm', '법정동'),
    jibun: pick(o, 'jibun', '지번'),
    sggCd: pick(o, 'sggCd', '지역코드'),
    area: Number.isFinite(area) ? area : null,
    floor: pick(o, 'floor', '층') != null ? Number(pick(o, 'floor', '층')) : null,
    buildYear: pick(o, 'buildYear', '건축년도') != null ? Number(pick(o, 'buildYear', '건축년도')) : null,
    contractDate: y && mo && d ? `${y}-${pad(mo)}-${pad(d)}` : null,
  }
  if (kind === 'sale') {
    const cancel = pick(o, 'cdealType', '해제여부')
    return {
      ...base,
      priceWon: manwonToWon(pick(o, 'dealAmount', '거래금액')),
      cancelled: cancel != null && /^O$/i.test(cancel),
      cancelDate: pick(o, 'cdealDay', '해제사유발생일'),
      dealingType: pick(o, 'dealingGbn', '거래유형'),
    }
  }
  const monthly = manwonToWon(pick(o, 'monthlyRent', '월세금액', '월세'))
  return {
    ...base,
    depositWon: manwonToWon(pick(o, 'deposit', '보증금액', '보증금')),
    monthlyWon: monthly,
    isJeonse: monthly === 0,
    contractType: pick(o, 'contractType', '계약구분'),
  }
}

/** 한 지역(LAWD_CD 5자리) · 한 달(YYYYMM) 전체 거래. 결과는 server/.cache 에 저장(지난달 이전은 하루, 이번 달은 1시간) */
export async function fetchMonth(kind, lawdCd, ym, serviceKey, { useCache = true } = {}) {
  const cacheDir = join(ROOT, 'server', '.cache')
  const cacheFile = join(cacheDir, `${kind}-${lawdCd}-${ym}.json`)
  const now = new Date()
  const thisYm = `${now.getFullYear()}${pad(now.getMonth() + 1)}`
  const maxAge = ym >= thisYm ? 3600_000 : 24 * 3600_000
  if (useCache && existsSync(cacheFile) && Date.now() - statSync(cacheFile).mtimeMs < maxAge) {
    return JSON.parse(readFileSync(cacheFile, 'utf8'))
  }
  const all = []
  let total = Infinity
  let lastRaw = ''
  for (let page = 1; all.length < total && page <= 20; page++) {
    const qs = new URLSearchParams({ serviceKey, LAWD_CD: lawdCd, DEAL_YMD: ym, pageNo: String(page), numOfRows: '1000' })
    const res = await fetch(`${ENDPOINTS[kind]}?${qs}`)
    const xml = await res.text()
    lastRaw = xml
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${xml.slice(0, 300)}`)
    const parsed = parseResponse(xml)
    if (!parsed.ok) throw Object.assign(new Error(parsed.error), { raw: xml.slice(0, 500) })
    total = parsed.totalCount
    all.push(...parsed.items.map((o) => normalizeItem(kind, o)))
    if (parsed.items.length === 0) break
  }
  const result = { kind, lawdCd, ym, fetchedAt: new Date().toISOString(), items: all, sampleRaw: lastRaw.slice(0, 400) }
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, JSON.stringify(result))
  return result
}

/** 최근 n개월 YYYYMM 목록 (이번 달 포함, 최신 순) */
export function recentMonths(n, from = new Date()) {
  const out = []
  for (let i = 0; i < n; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1)
    out.push(`${d.getFullYear()}${pad(d.getMonth() + 1)}`)
  }
  return out
}

/** 단지명 비교용: 공백·괄호·'아파트' 제거 */
export const squashName = (s) => String(s).replace(/\s|\(.*?\)|아파트/g, '').toLowerCase()
