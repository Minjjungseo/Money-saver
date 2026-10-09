import { addApartment, ensureRegionPath, findOrCreateUnit } from '@/store/ops'
import { PRICE_KIND_LABEL, PRICE_TYPE_LABEL, type AppData, type PriceKind, type PriceRecord, type PriceType } from '@/store/schema'
import { normalize } from '@/store/storage'
import { priceDedupeKey } from './calc'
import { parseCSV, toCSV } from './csv'
import { isValidISODate, todayISO } from './date'
import { newId, nowStamp } from './id'
import { parseEok, wonToEokInput } from './money'

export const BACKUP_APP_ID = 'my-real-estate-lab'

// ================= JSON =================

export function exportJSON(d: AppData): string {
  return JSON.stringify({ app: BACKUP_APP_ID, exportedAt: new Date().toISOString(), ...d }, null, 2)
}

export interface ImportStats {
  added: { regions: number; apartments: number; units: number; prices: number; notes: number; livingAreas: number; candidates: number }
  duplicates: number
  errors: { line: number | null; message: string }[]
}

function emptyStats(): ImportStats {
  return { added: { regions: 0, apartments: 0, units: 0, prices: 0, notes: 0, livingAreas: 0, candidates: 0 }, duplicates: 0, errors: [] }
}

const KINDS = new Set(['sale', 'jeonse'])
const TYPES = new Set(['actual', 'asking', 'other'])

function validPrice(p: unknown): p is PriceRecord {
  const r = p as PriceRecord
  return (
    !!r &&
    typeof r.id === 'string' &&
    typeof r.unitId === 'string' &&
    KINDS.has(r.kind) &&
    TYPES.has(r.priceType) &&
    Number.isSafeInteger(r.amountWon) &&
    r.amountWon > 0 &&
    typeof r.surveyDate === 'string' &&
    isValidISODate(r.surveyDate) &&
    (r.dealDate == null || isValidISODate(r.dealDate))
  )
}

/** 백업 JSON을 읽어 검증. 형식이 틀리면 예외 */
export function parseBackupJSON(text: string): AppData {
  let obj: unknown
  try {
    obj = JSON.parse(text)
  } catch {
    throw new Error('JSON 형식이 아닙니다')
  }
  const o = obj as Partial<AppData> & { app?: string }
  if (!o || typeof o !== 'object' || !Array.isArray(o.prices) || !Array.isArray(o.apartments)) {
    throw new Error('MY REAL ESTATE LAB 백업 파일이 아닙니다')
  }
  const bad = o.prices.filter((p) => !validPrice(p)).length
  if (bad) throw new Error(`가격 기록 ${bad}건의 형식이 올바르지 않아 가져오지 않았습니다`)
  return normalize(o)
}

/**
 * 병합: 현재 데이터는 그대로 두고 백업에만 있는 항목을 추가.
 * 같은 id, 또는 같은 내용(단지·면적·종류·금액·날짜·유형)의 가격은 중복으로 건너뛴다.
 */
export function mergeData(cur: AppData, incoming: AppData): { data: AppData; stats: ImportStats } {
  const stats = emptyStats()
  const pick = <T extends { id: string }>(a: T[], b: T[], key: keyof ImportStats['added']) => {
    const ids = new Set(a.map((x) => x.id))
    const add = b.filter((x) => !ids.has(x.id))
    stats.added[key] += add.length
    return [...a, ...add]
  }
  const regions = pick(cur.regions, incoming.regions, 'regions')
  const apartments = pick(cur.apartments, incoming.apartments, 'apartments')
  const units = pick(cur.units, incoming.units, 'units')
  const notes = pick(cur.notes, incoming.notes, 'notes')
  const livingAreas = pick(cur.livingAreas, incoming.livingAreas, 'livingAreas')
  const candidates = pick(cur.candidates, incoming.candidates, 'candidates')
  const ids = new Set(cur.prices.map((p) => p.id))
  const keys = new Set(cur.prices.map(priceDedupeKey))
  const prices = [...cur.prices]
  for (const p of incoming.prices) {
    const k = priceDedupeKey(p)
    if (ids.has(p.id) || keys.has(k)) {
      stats.duplicates++
      continue
    }
    ids.add(p.id)
    keys.add(k)
    prices.push(p)
    stats.added.prices++
  }
  return { data: { ...cur, regions, apartments, units, notes, livingAreas, candidates, prices }, stats }
}

// ================= CSV =================

export const CSV_HEADERS = [
  '시도', '시군구', '단지명', '전용면적', '평형', '면적타입', '가격종류', '금액(억)', '거래일', '조사일',
  '가격유형', '출처URL', '메모', '주소', '준공연도', '세대수', '과거자료',
] as const

export function exportPricesCSV(d: AppData): string {
  const unitById = new Map(d.units.map((u) => [u.id, u]))
  const aptById = new Map(d.apartments.map((a) => [a.id, a]))
  const regById = new Map(d.regions.map((r) => [r.id, r]))
  const rows: (string | number | null)[][] = [[...CSV_HEADERS]]
  for (const p of d.prices) {
    const u = unitById.get(p.unitId)
    const a = u && aptById.get(u.apartmentId)
    const r = a && regById.get(a.regionId)
    if (!u || !a || !r) continue
    const [sido, ...rest] = r.id.split('/')
    rows.push([
      sido, rest.join(' '), a.name, u.exclusiveArea, u.pyeong, u.label, PRICE_KIND_LABEL[p.kind], wonToEokInput(p.amountWon),
      p.dealDate, p.surveyDate, PRICE_TYPE_LABEL[p.priceType], p.sourceUrl, p.memo, a.address, a.builtYear,
      a.households, p.legacy ? 'Y' : '',
    ])
  }
  return toCSV(rows)
}

export function csvTemplate(): string {
  return toCSV([
    [...CSV_HEADERS],
    ['서울', '강남구', '(단지명 입력)', 84.97, '', '84A', '매매', '25.5', '2026-09-15', '2026-10-01', '실거래가', 'https://rt.molit.go.kr', '', '', '', '', ''],
  ])
}

const SIDO_ALIAS: Record<string, string> = {
  서울특별시: '서울', 서울시: '서울', 경기도: '경기', 인천광역시: '인천', 인천시: '인천',
  부산광역시: '부산', 대구광역시: '대구', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산',
  세종특별자치시: '세종', 세종시: '세종', 충청북도: '충북', 충청남도: '충남', 강원도: '강원',
  강원특별자치도: '강원', 전라북도: '전북', 전북특별자치도: '전북', 전라남도: '전남',
  경상북도: '경북', 경상남도: '경남', 제주도: '제주', 제주특별자치도: '제주',
}

function normDate(v: string): string | null {
  const s = v.trim().replace(/[./]/g, '-')
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (!m) return null
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  return isValidISODate(iso) ? iso : null
}

function parseKind(v: string): PriceKind | null {
  const s = v.trim()
  if (s === '매매' || s === 'sale') return 'sale'
  if (s === '전세' || s === 'jeonse') return 'jeonse'
  return null
}

function parseType(v: string): PriceType | null {
  const s = v.trim()
  if (s === '' || s === '기타' || s === 'other') return 'other'
  if (s === '실거래가' || s === '실거래' || s === 'actual') return 'actual'
  if (s === '호가' || s === 'asking') return 'asking'
  return null
}

function optInt(v: string): number | null | 'bad' {
  const s = v.trim().replace(/,/g, '')
  if (!s) return null
  return /^\d+$/.test(s) ? Number(s) : 'bad'
}

const squash = (s: string) => s.replace(/\s+/g, '')

/**
 * 가격 CSV 가져오기. 저장하지 않고 결과(새 데이터 + 통계)만 돌려준다 → 화면에서 미리보기 후 확정.
 * 지역·단지·면적은 이름으로 찾고, 없으면 새로 만든다.
 */
export function importPricesCSV(cur: AppData, text: string, today = todayISO()): { data: AppData; stats: ImportStats } {
  const stats = emptyStats()
  const rows = parseCSV(text)
  if (rows.length === 0) {
    stats.errors.push({ line: null, message: '빈 파일입니다' })
    return { data: cur, stats }
  }
  const header = rows[0].map((h) => h.trim())
  const col = (name: string) => header.indexOf(name)
  for (const req of ['시도', '단지명', '가격종류', '금액(억)', '조사일']) {
    if (col(req) < 0) stats.errors.push({ line: 1, message: `필수 열 "${req}"이(가) 없습니다` })
  }
  if (stats.errors.length) return { data: cur, stats }

  let d = cur
  const keys = new Set(d.prices.map(priceDedupeKey))
  const t = nowStamp()
  const newPrices: PriceRecord[] = []

  rows.slice(1).forEach((row, i) => {
    const line = i + 2
    const get = (name: string) => (col(name) >= 0 ? (row[col(name)] ?? '').trim() : '')
    const err = (message: string) => stats.errors.push({ line, message })

    const sidoRaw = get('시도')
    const sido = SIDO_ALIAS[sidoRaw] ?? sidoRaw
    const sidoRegion = d.regions.find((r) => r.type === 'sido' && r.name === sido)
    if (!sidoRegion) return err(`알 수 없는 시도 "${sidoRaw}"`)
    const aptName = get('단지명')
    if (!aptName) return err('단지명이 비어 있습니다')
    const areaRaw = get('전용면적')
    const pyeongRaw = get('평형')
    const area = areaRaw ? Number(areaRaw) : null
    const pyeong = pyeongRaw ? Number(pyeongRaw) : null
    if (area != null && (!Number.isFinite(area) || area < 10 || area > 400)) return err(`전용면적 "${areaRaw}"이(가) 올바르지 않습니다`)
    if (pyeong != null && (!Number.isFinite(pyeong) || pyeong < 5 || pyeong > 150)) return err(`평형 "${pyeongRaw}"이(가) 올바르지 않습니다`)
    if (area == null && pyeong == null) return err('전용면적 또는 평형 중 하나는 입력해야 합니다')
    const kind = parseKind(get('가격종류'))
    if (!kind) return err('가격종류는 "매매" 또는 "전세"여야 합니다')
    const amount = parseEok(get('금액(억)'))
    if (!amount.ok) return err(`금액: ${amount.error}`)
    const surveyDate = normDate(get('조사일'))
    if (!surveyDate) return err('조사일 형식이 올바르지 않습니다 (예: 2026-10-01)')
    if (surveyDate > today) return err('조사일이 미래입니다')
    const dealRaw = get('거래일')
    const dealDate = dealRaw ? normDate(dealRaw) : null
    if (dealRaw && !dealDate) return err('거래일 형식이 올바르지 않습니다')
    if (dealDate && dealDate > today) return err('거래일이 미래입니다')
    const priceType = parseType(get('가격유형'))
    if (!priceType) return err('가격유형은 실거래가/호가/기타 중 하나여야 합니다')
    const builtYear = optInt(get('준공연도'))
    const households = optInt(get('세대수'))
    if (builtYear === 'bad' || households === 'bad') return err('준공연도·세대수는 숫자만 입력하세요')
    const sourceUrl = get('출처URL') || null
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return err('출처URL은 http:// 또는 https:// 로 시작해야 합니다')

    // 지역
    const path = get('시군구').split(/\s+/).filter(Boolean)
    const reg = ensureRegionPath(d, sidoRegion.id, path)
    d = reg.data
    const regionId = reg.regionId
    stats.added.regions += reg.created
    // 단지
    let apt = d.apartments.find((a) => a.regionId === regionId && squash(a.name) === squash(aptName))
    if (!apt) {
      const res = addApartment(d, {
        regionId, name: aptName, address: get('주소') || null, builtYear, households, isLandmark: true, memo: null,
      })
      d = res.data
      apt = res.apartment
      stats.added.apartments++
    }
    // 면적
    const before = d.units.length
    const ures = findOrCreateUnit(d, apt.id, { area, pyeong, label: get('면적타입') || null })
    d = ures.data
    if (d.units.length > before) stats.added.units++

    const rec: PriceRecord = {
      id: newId('price'), unitId: ures.unit.id, kind, amountWon: amount.won, dealDate, surveyDate, priceType,
      sourceUrl, memo: get('메모') || null, entryId: null, legacy: /^(y|yes|o|예|true|1)$/i.test(get('과거자료')),
      isSample: false, createdAt: t, updatedAt: t,
    }
    const k = priceDedupeKey(rec)
    if (keys.has(k)) {
      stats.duplicates++
      return
    }
    keys.add(k)
    newPrices.push(rec)
    stats.added.prices++
  })

  return { data: { ...d, prices: [...d.prices, ...newPrices] }, stats }
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
