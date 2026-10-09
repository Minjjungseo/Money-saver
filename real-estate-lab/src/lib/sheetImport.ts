/**
 * 기존 Google Sheets(2026 공부용 사본) → 앱 데이터 변환.
 *
 * 원본 구조 (시세트래킹 탭)
 * - 1행: 열 제목(매매/전세/전세율 반복), 2행: 조사 날짜(3열마다 1개)
 * - A열 "서울", "경기", "부산"… 처럼 단독으로 적힌 행 = 구역 제목
 * - 데이터 행: A=순번(추가 단지는 비어 있음), B=지역(서울은 "강남구(1군)"처럼 급지 포함), C=단지명(평형")
 * - 같은 값을 다른 모양으로 보여주는 지도형 탭(수도권/광역시/중소도시)과 data 탭은 가져오지 않는다.
 * - 전국 랜드마크 가격 순서 탭에서는 세대수·연식만 가져온다.
 *
 * 가져오기 원칙
 * - 가격 기준(실거래가/호가)이 적혀 있지 않으므로 모두 가격유형 '기타', '과거자료'로 저장한다.
 * - 평형(34")은 공급면적 기준이라 전용면적으로 바꾸지 않고 평형 그대로 보존한다.
 * - 전세가 비어 있거나 0이면 값 없음으로 본다(0원으로 저장하지 않는다).
 */
import { parseEok } from './money'
import { addApartment, addPriceEntry, ensureRegionPath } from '@/store/ops'
import type { AppData, ApartmentUnit, ID } from '@/store/schema'
import { newId } from './id'

export type Cell = string | number | boolean | Date | null | undefined
export type SheetRows = Cell[][]

interface SectionDef {
  sido: string
  /** 중소도시 구역처럼 B열이 구 이름만 있을 때 앞에 붙일 시 이름 */
  city?: string
}

const SECTIONS: Record<string, SectionDef> = {
  서울: { sido: '서울' },
  경기: { sido: '경기' },
  세종시: { sido: '세종' },
  세종: { sido: '세종' },
  인천: { sido: '인천' },
  부산: { sido: '부산' },
  대구: { sido: '대구' },
  대전: { sido: '대전' },
  광주: { sido: '광주' },
  울산: { sido: '울산' },
  창원: { sido: '경남', city: '창원시' },
  천안: { sido: '충남', city: '천안시' },
  청주: { sido: '충북', city: '청주시' },
  전주: { sido: '전북', city: '전주시' },
  김해: { sido: '경남' },
  포항: { sido: '경북', city: '포항시' },
  경북: { sido: '경북' },
  경남: { sido: '경남' },
  충북: { sido: '충북' },
  충남: { sido: '충남' },
  전북: { sido: '전북' },
  전남: { sido: '전남' },
  강원: { sido: '강원' },
  제주: { sido: '제주' },
}

/** 구역 제목이지만 시·도가 아닌 묶음 제목 (무시) */
const GROUP_TITLES = new Set(['광역시', '중소도시', '30만 이상 중소도시'])

export interface SheetRowPreview {
  line: number
  section: string
  rawRegion: string
  name: string
  regionId: string
  note: string | null
}

export interface SheetImportResult {
  data: AppData
  dates: string[]
  stats: {
    apartments: number
    units: number
    prices: number
    regions: number
    duplicates: number
    metadataMatched: number
  }
  rows: SheetRowPreview[]
  warnings: string[]
}

const str = (v: Cell) => (v == null ? '' : String(v).trim())
const squash = (s: string) => s.replace(/\s+/g, '')

function toISO(v: Cell): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  return null
}

/** "래미안라클래시(34")" → { name: "래미안라클래시", pyeong: 34 } / 범위·미표기는 label로 */
export function parseAptName(raw: string): { name: string; pyeong: number | null; label: string | null } {
  const m = /^(.*?)\s*\(\s*([\d.]+(?:\s*~\s*[\d.]+)?)\s*["”″]?\s*\)\s*$/.exec(raw)
  if (!m) return { name: raw.trim(), pyeong: null, label: null }
  const size = m[2].replace(/\s/g, '')
  if (size.includes('~')) return { name: m[1].trim(), pyeong: null, label: `${size}평` }
  return { name: m[1].trim(), pyeong: Number(size), label: null }
}

/** "강남구(1군)" → { name: "강남구", grade: "1군" } */
function stripGrade(raw: string): { name: string; grade: string | null } {
  const m = /^(.*?)\s*\((\d군)\)\s*$/.exec(raw)
  return m ? { name: m[1].trim(), grade: m[2] } : { name: raw.trim(), grade: null }
}

function withSiSuffix(s: string): string {
  return /[시군구]$/.test(s) ? s : `${s}시`
}

/**
 * B열 지역 → 시·도 아래 경로.
 * 인천은 2026-07-01 행정구역 개편을 반영한다(옛 이름은 메모로 남긴다).
 */
function regionParts(section: SectionDef, region: string, aptName: string): { parts: string[]; note: string | null } {
  if (section.sido === '세종') return { parts: [], note: null }
  if (section.sido === '인천') {
    if (region === '서구') {
      const gu = aptName.includes('검단') ? '검단구' : '서해구'
      return { parts: [gu], note: `원본 지역 "인천 서구" → 2026.7 개편 후 ${gu}로 추정` }
    }
    if (region === '중구') {
      const gu = aptName.includes('영종') ? '영종구' : '제물포구'
      return { parts: [gu], note: `원본 지역 "인천 중구" → 2026.7 개편 후 ${gu}로 추정` }
    }
    if (region === '동구') return { parts: ['제물포구'], note: '원본 지역 "인천 동구" → 2026.7 개편 후 제물포구' }
    return { parts: [region], note: null }
  }
  if (section.city) return { parts: [section.city, region], note: null }
  if (section.sido === '경기' || section.sido === '경남' || section.sido === '경북' || section.sido === '강원' || section.sido === '충북' || section.sido === '충남' || section.sido === '전북' || section.sido === '전남') {
    const [first, ...rest] = region.split(/\s+/)
    return { parts: [withSiSuffix(first), ...rest], note: null }
  }
  return { parts: [region], note: null }
}

interface Meta {
  households: number | null
  builtYear: number | null
}

/** 전국 랜드마크 가격 순서 탭: H=단지명(평형), I=세대수, J=연식 (열 위치는 제목 행으로 찾는다) */
function readMeta(rows: SheetRows | null): Map<string, Meta> {
  const out = new Map<string, Meta>()
  if (!rows) return out
  const headerIdx = rows.findIndex((r) => r.some((c) => str(c) === '랜드마크 단지명'))
  if (headerIdx < 0) return out
  const h = rows[headerIdx].map(str)
  const cName = h.indexOf('랜드마크 단지명')
  const cHh = h.indexOf('세대수')
  const cYear = h.indexOf('연식')
  for (const r of rows.slice(headerIdx + 1)) {
    const name = str(r[cName])
    if (!name) continue
    const hh = Number(r[cHh])
    const yr = Number(r[cYear])
    out.set(squash(name), {
      households: Number.isInteger(hh) && hh > 0 ? hh : null,
      builtYear: Number.isInteger(yr) && yr > 1950 && yr < 2100 ? yr : null,
    })
  }
  return out
}

function amountWon(v: Cell): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null
  const r = parseEok(String(Number(v.toFixed(4))))
  return r.ok ? r.won : null
}

export function importTrackingSheet(cur: AppData, tracking: SheetRows, landmark: SheetRows | null = null): SheetImportResult {
  const warnings: string[] = []
  const stats = { apartments: 0, units: 0, prices: 0, regions: 0, duplicates: 0, metadataMatched: 0 }
  const preview: SheetRowPreview[] = []

  // 날짜 행 찾기: 날짜 셀이 2개 이상 있는 첫 행
  const dateRowIdx = tracking.findIndex((r) => r.filter((c) => toISO(c)).length >= 2)
  if (dateRowIdx < 0) throw new Error('시세트래킹 탭에서 조사 날짜 행(2행)을 찾지 못했습니다')
  const dateCols: { col: number; date: string }[] = []
  tracking[dateRowIdx].forEach((c, i) => {
    const d = toISO(c)
    if (d) dateCols.push({ col: i, date: d })
  })
  const header = tracking[dateRowIdx - 1] ?? []
  for (const { col } of dateCols) {
    if (str(header[col]) !== '매매' || str(header[col + 1]) !== '전세') {
      throw new Error(`날짜 열(${col + 1}열) 아래가 "매매, 전세" 순서가 아닙니다. 시트 구조가 바뀌었는지 확인하세요`)
    }
  }

  const meta = readMeta(landmark)
  let d = cur
  let section: SectionDef | null = null
  let sectionName = ''
  let lastRegionRaw = ''

  tracking.slice(dateRowIdx + 1).forEach((r, i) => {
    const line = dateRowIdx + 2 + i
    const a = str(r[0])
    const b = str(r[1])
    const c = str(r[2])
    if (!a && !b && !c) return
    // 구역 제목 행
    if (a && !b && !c && typeof r[0] === 'string') {
      if (GROUP_TITLES.has(a)) return
      const def = SECTIONS[a]
      if (!def) {
        warnings.push(`${line}행: 알 수 없는 구역 "${a}" — 아래 단지는 건너뜁니다`)
        section = null
      } else {
        section = def
        sectionName = a
      }
      lastRegionRaw = ''
      return
    }
    if (!c) return
    if (!section) {
      warnings.push(`${line}행: 구역을 알 수 없어 "${c}"을(를) 건너뜁니다`)
      return
    }
    const sec: SectionDef = section
    let note: string | null = null
    let regionRaw = b
    if (!regionRaw) {
      if (!lastRegionRaw) {
        warnings.push(`${line}행: 지역이 비어 있어 "${c}"을(를) 건너뜁니다`)
        return
      }
      regionRaw = lastRegionRaw
      note = `지역 칸이 비어 있어 바로 위 행(${stripGrade(lastRegionRaw).name})과 같은 지역으로 추정`
    }
    lastRegionRaw = regionRaw
    const { name: regionName, grade } = stripGrade(regionRaw)
    const { name, pyeong, label } = parseAptName(c)
    const rp = regionParts(sec, regionName, name)
    if (rp.note) note = note ? `${note} / ${rp.note}` : rp.note
    const sidoRegion = d.regions.find((x) => x.type === 'sido' && x.name === sec.sido)
    if (!sidoRegion) {
      warnings.push(`${line}행: 시·도 "${sec.sido}"이(가) 앱에 없습니다`)
      return
    }
    const reg = ensureRegionPath(d, sidoRegion.id, rp.parts)
    d = reg.data
    stats.regions += reg.created

    // 단지
    let apt = d.apartments.find((x) => x.regionId === reg.regionId && squash(x.name) === squash(name))
    if (!apt) {
      const m = meta.get(squash(c))
      if (m) stats.metadataMatched++
      const memo = [
        '기존 시트(시세트래킹)에서 가져온 단지',
        grade ? `급지: ${grade} (원본 시트 기준)` : null,
        `원본 표기: ${sectionName} / ${regionRaw} / ${c}`,
        note,
      ]
        .filter(Boolean)
        .join('\n')
      const res = addApartment(d, {
        regionId: reg.regionId,
        name,
        address: null,
        builtYear: m?.builtYear ?? null,
        households: m?.households ?? null,
        isLandmark: typeof r[0] === 'number',
        memo,
      })
      d = res.data
      apt = res.apartment
      stats.apartments++
    }
    preview.push({ line, section: sectionName, rawRegion: b, name: c, regionId: reg.regionId, note })

    // 면적: 같은 평형(+범위 표기)의 기존 면적이 있으면 재사용 (나중에 전용면적을 채웠어도 같은 면적)
    const aptId: ID = apt.id
    let unit: ApartmentUnit | undefined = d.units.find(
      (u) => u.apartmentId === aptId && (u.pyeong ?? null) === pyeong && (u.label ?? null) === label,
    )
    if (!unit) {
      unit = { id: newId('unit'), apartmentId: aptId, exclusiveArea: null, pyeong, label, isSample: false }
      d = { ...d, units: [...d.units, unit] }
      stats.units++
    }

    for (const { col, date } of dateCols) {
      const sale = amountWon(r[col])
      const jeonse = amountWon(r[col + 1])
      if (sale == null && jeonse == null) continue
      const before = d.prices.length
      const res = addPriceEntry(d, {
        unitId: unit.id,
        surveyDate: date,
        priceType: 'other',
        sourceUrl: null,
        memo: `기존 시트 시세트래킹 ${date.replace(/-/g, '.')} 열 (가격 기준 미표기)`,
        sale: sale == null ? null : { amountWon: sale, dealDate: null },
        jeonse: jeonse == null ? null : { amountWon: jeonse, dealDate: null },
        legacy: true,
      })
      d = res.data
      stats.prices += d.prices.length - before
      stats.duplicates += res.skipped.length
    }
  })

  if (meta.size && stats.metadataMatched < stats.apartments) {
    warnings.push(`새 단지 ${stats.apartments}개 중 ${stats.apartments - stats.metadataMatched}개는 '전국 랜드마크 가격 순서' 탭에서 같은 이름을 찾지 못해 세대수·연식을 비워 두었습니다`)
  }

  return { data: d, dates: dateCols.map((x) => x.date), stats, rows: preview, warnings }
}
