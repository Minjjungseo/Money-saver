/**
 * 국토교통부 실거래가 일괄 조회 → CSV (Google Sheets 검토용)
 *
 *   npm run molit:batch                 대표 단지 20개 (기본)
 *   npm run molit:batch -- --all        server/landmarks.json 에서 지역코드(lawdCd)가 있는 단지 전부
 *   npm run molit:batch -- --only 잠실엘스
 *   npm run molit:batch -- --no-cache   캐시 무시하고 새로 조회
 *
 * 원칙
 *  - 매매와 전세를 각각 독립적으로 최근 6개월 → 12개월 → 24개월까지 넓혀 찾는다.
 *    한쪽을 찾았다고 다른 쪽 조회를 멈추지 않는다.
 *  - 해제된 매매는 최신값에서 빼고 건수만 센다. 전세는 월세 0원 계약만 본다(신규 계약 우선).
 *  - 단지명·면적이 확실하지 않으면 '검증 필요'와 이유를 적는다. 추정값으로 채우지 않는다.
 *  - 결과는 server/output/ 아래 새 파일로만 저장한다. 앱 데이터·시트의 기존 가격은 건드리지 않는다.
 *  - 인증키는 .env.local 에서만 읽고 화면·로그·CSV에 남기지 않는다.
 */
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, fetchMonth, loadServiceKey, recentMonths } from './molit.mjs'
import { chooseAreaType, jeonseRatio, matchName, pickLatestJeonse, pickLatestSale, similarNames, typeWindow } from './match.mjs'

export const PERIODS = [6, 12, 24]
export const SOURCE = '국토교통부 실거래가 API (공공데이터포털 15126469 매매 / 15126474 전월세)'
const DATE_GAP_WARN_DAYS = 90

const pad = (n) => String(n).padStart(2, '0')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
export const toEok = (won) => (won == null ? null : Number((won / 1e8).toFixed(4)))
const daysBetween = (a, b) => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000)
const nameLevelLabel = { exact: '일치', alias: '일치(직접 지정한 이름)', partial: '부분 일치', none: '못 찾음' }

const usableOf = (kind, items) =>
  kind === 'sale' ? items.filter((it) => !it.cancelled && it.priceWon != null) : items.filter((it) => it.isJeonse && it.depositWon != null)

/**
 * 한 종류(매매 또는 전세)를 6 → 12 → 24개월로 넓혀 찾는다.
 * names 가 null 이면 매번 단지명을 다시 맞춰 보고, 주어지면 그 API 단지명만 쓴다.
 * @returns {{ period: number|null, monthsFetched: number, region: object[], name: object, mine: object[], inBand: object[] }}
 */
async function searchKind(kind, lm, band, getMonth, months, names = null) {
  const region = []
  let fetched = 0
  let last = null
  for (const p of PERIODS) {
    for (const ym of months.slice(fetched, p)) region.push(...(await getMonth(kind, lm.lawdCd, ym)).items.map((it) => ({ ...it, ym })))
    fetched = p
    const name = names ? { level: 'fixed', names } : matchName(lm, region)
    const mine = region.filter((it) => name.names.includes(it.aptName))
    const inBand = mine.filter((it) => it.area != null && it.area >= band.min && it.area <= band.max)
    last = { period: usableOf(kind, inBand).length ? p : null, monthsFetched: p, region, name, mine, inBand }
    if (last.period) return last
  }
  return last
}

const monthsAgo = (date, now) => {
  const d = new Date(date)
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}
const uniqSorted = (arr) => [...new Set(arr.filter((v) => v != null && v !== ''))].sort()

/** 단지 1개 조회 → { row(요약), trades(상세) } */
export async function lookupLandmark(lm, { getMonth, now = new Date() }) {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const win = typeWindow(lm)
  const row = emptyRow(lm, today)
  if (!lm.lawdCd) {
    row.상태 = '지역코드 없음'
    row.매칭검증사유 = 'server/landmarks.json 에 lawdCd(시군구 5자리)를 적으면 조회됩니다'
    return { row, trades: [] }
  }
  const months = recentMonths(24, now)
  const match = [] // 매칭(단지명·지역·면적) 불확실 → 검증 필요
  const caution = [] // 매칭은 맞지만 거래 시점·성격 주의 → 거래 시점 주의

  // 1차: 평형으로 있을 수 있는 면적 범위 안에서 매매·전세를 각각 찾는다
  const sale1 = await searchKind('sale', lm, win, getMonth, months)
  const rent1 = await searchKind('rent', lm, win, getMonth, months)

  // 지역코드 점검: 응답 지역코드 대부분이 요청과 같아야 한다 (한두 건 다른 값은 무시)
  const regionAll = [...sale1.region, ...rent1.region]
  const coded = regionAll.filter((it) => /^\d{5}$/.test(String(it.sggCd ?? '')))
  const same = coded.filter((it) => it.sggCd === lm.lawdCd).length
  row.지역코드일치 = coded.length ? `${Math.round((same / coded.length) * 100)}% (${coded.length}건 중 ${same})` : regionAll.length ? '응답에 지역코드 없음' : '거래 0건'
  if (regionAll.length === 0 || (coded.length && same / coded.length < 0.5)) {
    const others = uniqSorted(coded.filter((it) => it.sggCd !== lm.lawdCd).map((it) => it.sggCd)).join(', ')
    row.상태 = '지역코드 확인 필요'
    row.매칭검증사유 = regionAll.length
      ? `요청 ${lm.lawdCd} / 응답 지역코드 대부분 ${others}`
      : `지역코드 ${lm.lawdCd} 로 24개월간 이 시군구 전체 거래가 0건 (코드 확인 필요)`
    return { row, trades: [] }
  }

  // 단지명: 매매·전세 거래를 합쳐 한 번에 맞춘다
  const name = matchName(lm, regionAll)
  row.API단지명 = name.names.join(' / ')
  row.단지매칭 = nameLevelLabel[name.level]
  if (name.level === 'none') {
    const sim = similarNames(lm.name, regionAll.map((it) => it.aptName))
    row.상태 = '단지명 확인 필요'
    row.매칭검증사유 = sim.length
      ? `같은 시군구에서 같은 이름을 못 찾음. 비슷한 API 단지명: ${sim.join(', ')} → 맞으면 landmarks.json 의 apiNames 에 적어 주세요`
      : '같은 시군구에서 같은/비슷한 이름을 못 찾음 (지역코드·단지명 확인 필요)'
    return { row, trades: [] }
  }
  const mineAll = regionAll.filter((it) => name.names.includes(it.aptName))
  const dongs = uniqSorted(mineAll.map((it) => it.dong))
  const years = uniqSorted(mineAll.map((it) => it.buildYear))
  row.법정동 = dongs.join(' / ')
  row.준공연도 = years.join(' / ')
  if (name.level === 'partial') match.push(`단지명 부분 일치(API: ${name.names.join(', ')}) — 같은 단지인지 확인`)
  if (dongs.length > 1) match.push(`API 단지명이 여러 법정동에 있음(${dongs.join(', ')}) — 다른 단지가 섞였는지 확인`)
  if (name.names.length > 1) row.블록구분 = `API 단지명 ${name.names.length}개 합산: ${name.names.join(', ')}`
  if (name.names.length > 1 && years.length > 1) match.push(`합산한 API 단지명의 준공연도가 다름(${years.join(', ')}) — 같은 단지·블록인지 확인`)

  // 전용면적 타입 하나만 고른다. 거래가 적은 타입을 놓치지 않도록 전월세(월세 포함)는 최소 12개월을 본다
  const typeItems = [...mineAll]
  for (const ym of months.slice(rent1.monthsFetched, 12)) {
    typeItems.push(...(await getMonth('rent', lm.lawdCd, ym)).items.filter((it) => name.names.includes(it.aptName)))
  }
  const type = chooseAreaType(lm, typeItems)
  row.면적기준 = type.label
  row.면적후보 = type.candidates
  if (!type.band) {
    row.상태 = '거래 없음'
    row.매칭검증사유 = `${type.label}. 이 단지의 거래 면적: ${type.candidates || '없음'} → 맞는 타입이면 landmarks.json 에 areaMin/areaMax 를 적어 주세요`
    return { row, trades: [] }
  }
  row.선택전용타입 = type.band.min === type.band.max ? `${type.band.min}㎡` : `${type.band.min}~${type.band.max}㎡`
  if (!type.certain) match.push(`면적 타입 불확실: ${type.label}`)

  // 2차: 고른 타입으로 매매·전세를 각각 다시 6 → 12 → 24개월 (이미 받은 달은 다시 호출하지 않음)
  const band = { min: type.band.min - 0.005, max: type.band.max + 0.005 }
  const sale = await searchKind('sale', lm, band, getMonth, months, name.names)
  const rent = await searchKind('rent', lm, band, getMonth, months, name.names)

  // 매매
  const s = pickLatestSale(sale.inBand)
  row.매매건수 = s.count
  row.해제제외건수 = s.cancelledCount
  row.매매조회기간 = sale.period ? `최근 ${sale.period}개월` : '24개월 내 없음'
  if (s.latest) {
    Object.assign(row, {
      '매매가(억)': toEok(s.latest.priceWon), '매매가(원)': s.latest.priceWon, 매매계약일: s.latest.contractDate,
      매매전용면적: s.latest.area, 매매층: s.latest.floor, 매매거래유형: s.latest.dealingType ?? '',
    })
    const ago = monthsAgo(s.latest.contractDate, now)
    if (ago > 6) caution.push(`최신 매매가 ${ago}개월 전 거래`)
    if (s.latest.dealingType && /직거래/.test(s.latest.dealingType)) caution.push('최신 매매가 직거래(특수관계 거래 등으로 시세와 다를 수 있음)')
  }

  // 전세 (매매 면적과 같은 면적 우선)
  const j = pickLatestJeonse(rent.inBand, s.latest?.area ?? null)
  row.전세건수 = j.count
  row.전세조회기간 = rent.period ? `최근 ${rent.period}개월` : '24개월 내 없음'
  if (j.latest) {
    Object.assign(row, {
      '전세가(억)': toEok(j.latest.depositWon), '전세가(원)': j.latest.depositWon, 전세계약일: j.latest.contractDate,
      전세전용면적: j.latest.area, 전세층: j.latest.floor, 전세계약구분: j.latest.contractType ?? '',
    })
    const ago = monthsAgo(j.latest.contractDate, now)
    if (ago > 6) caution.push(`최신 전세가 ${ago}개월 전 거래`)
    if (j.renewalOnly) caution.push('최신 전세가 갱신 계약뿐(인상 상한 적용으로 시세보다 낮을 수 있음)')
  }

  // 전세가율 (같은 타입 안에서도 ±1㎡ 넘게 다르면 계산하지 않음)
  if (s.latest && j.latest) {
    const r = jeonseRatio(s.latest, j.latest)
    if (r == null) match.push(`매매(${s.latest.area}㎡)와 전세(${j.latest.area}㎡) 면적이 달라 전세가율 계산 안 함`)
    else {
      row['전세가율(%)'] = Number(r.toFixed(1))
      const gap = daysBetween(s.latest.contractDate, j.latest.contractDate)
      if (gap > DATE_GAP_WARN_DAYS) caution.push(`매매·전세 계약일 차이 ${gap}일 — 전세가율 해석 주의`)
    }
  }

  const missing = []
  if (!s.latest) missing.push('매매 거래 없음(24개월)')
  if (!j.latest) missing.push('전세 거래 없음(24개월)')
  row.매칭검증사유 = match.join(' / ')
  row.거래주의사유 = [...caution, ...missing].join(' / ')
  if (!s.latest && !j.latest) row.상태 = '거래 없음'
  else if (match.length) row.상태 = '검증 필요'
  else if (caution.length) row.상태 = '거래 시점 주의'
  else if (missing.length) row.상태 = '일부 거래 없음'
  else row.상태 = '정상'

  // 상세 거래 (기준 면적 안, 조회한 기간 전체)
  const pickedSale = s.latest
  const pickedJeonse = j.latest
  const trades = [
    ...sale.inBand.map((it) => ({ it, kind: '매매' })),
    ...rent.inBand.filter((it) => it.isJeonse).map((it) => ({ it, kind: '전세' })),
  ]
    .sort((a, b) => (b.it.contractDate ?? '').localeCompare(a.it.contractDate ?? ''))
    .map(({ it, kind }) => ({
      시트단지명: row.시트단지명,
      시도: row.시도,
      시군구: row.시군구,
      구분: kind,
      API단지명: it.aptName,
      법정동: it.dong ?? '',
      지번: it.jibun ?? '',
      전용면적: it.area,
      층: it.floor,
      계약일: it.contractDate,
      '금액(억)': toEok(kind === '매매' ? it.priceWon : it.depositWon),
      '금액(원)': kind === '매매' ? it.priceWon : it.depositWon,
      해제여부: kind === '매매' ? (it.cancelled ? '해제' : '') : '',
      해제사유발생일: kind === '매매' ? (it.cancelDate ?? '') : '',
      거래유형: kind === '매매' ? (it.dealingType ?? '') : '',
      계약구분: kind === '전세' ? (it.contractType ?? '') : '',
      건축년도: it.buildYear ?? '',
      요약에사용: it === pickedSale || it === pickedJeonse ? 'Y' : '',
    }))
  return { row, trades }
}

/** CSV 한 칸 */
function cell(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
/** 객체 배열 → CSV (UTF-8 BOM 포함: 엑셀·구글 시트에서 한글이 깨지지 않게) */
export function toCsv(objs, headers = objs.length ? Object.keys(objs[0]) : []) {
  return '﻿' + [headers.map(cell).join(','), ...objs.map((o) => headers.map((h) => cell(o[h])).join(','))].join('\r\n') + '\r\n'
}

const APP_HEADERS = ['시도', '시군구', '단지명', '전용면적', '평형', '면적타입', '가격종류', '금액(억)', '거래일', '조사일', '가격유형', '출처URL', '메모', '주소', '준공연도', '세대수', '과거자료']

/** '정상' 행만 앱의 가격 CSV 형식으로 (앱 → 백업 → 가져오기에서 미리보기 후 추가. 기존 기록은 바뀌지 않음) */
export function appImportRows(results, landmarks) {
  const out = []
  for (const { row } of results) {
    if (row.상태 !== '정상') continue
    const lm = landmarks.find((l) => (l.sheetText ?? l.name) === row.시트단지명)
    const base = { 시도: row.시도, 시군구: row.시군구, 단지명: lm?.name ?? row.시트단지명, 평형: '', 면적타입: '', 조사일: row.조회일, 가격유형: '실거래가', 출처URL: 'https://rt.molit.go.kr', 주소: '', 준공연도: '', 세대수: '', 과거자료: '' }
    out.push({ ...base, 전용면적: row.매매전용면적, 가격종류: '매매', '금액(억)': row['매매가(억)'], 거래일: row.매매계약일, 메모: `국토부 API 일괄조회 · API 단지명 ${row.API단지명} · ${row.매매층}층` })
    out.push({ ...base, 전용면적: row.전세전용면적, 가격종류: '전세', '금액(억)': row['전세가(억)'], 거래일: row.전세계약일, 메모: `국토부 API 일괄조회 · API 단지명 ${row.API단지명} · ${row.전세층}층 · ${row.전세계약구분 || '계약구분 없음'}` })
  }
  return out
}

/**
 * 일괄 조회 실행
 * @param {object} o
 * @param {object[]} o.landmarks  조회할 단지
 * @param {(kind, lawdCd, ym) => Promise<{items, fromCache?, requests?}>} o.fetcher  한 달치 조회 함수
 * @param {number} [o.gapMs]  실제 호출 사이 간격 (캐시 적중은 기다리지 않음)
 */
export async function runBatch({ landmarks, fetcher, now = new Date(), gapMs = 150, log = console.log }) {
  const memo = new Map()
  const stats = { requests: 0, cacheHits: 0, months: 0 }
  let fatal = null
  const getMonth = async (kind, lawdCd, ym) => {
    const k = `${kind}-${lawdCd}-${ym}`
    if (memo.has(k)) return memo.get(k)
    const r = await fetcher(kind, lawdCd, ym)
    stats.months++
    if (r.fromCache) stats.cacheHits++
    else {
      stats.requests += r.requests ?? 1
      if (gapMs) await sleep(gapMs)
    }
    memo.set(k, r)
    return r
  }
  const results = []
  for (const [i, lm] of landmarks.entries()) {
    const label = `[${i + 1}/${landmarks.length}] ${lm.sheetText ?? lm.name}`
    if (fatal) {
      results.push(stub(lm, now, '중단', `앞 단지에서 멈춤: ${fatal}`))
      continue
    }
    try {
      const r = await lookupLandmark(lm, { getMonth, now })
      results.push(r)
      const x = r.row
      log(`${label} → ${x.상태}  매매 ${x['매매가(억)'] ?? '-'}억(${x.매매계약일 ?? '-'})  전세 ${x['전세가(억)'] ?? '-'}억(${x.전세계약일 ?? '-'})  전세가율 ${x['전세가율(%)'] ?? '-'}%`)
    } catch (e) {
      const msg = e?.message ?? String(e)
      if (e?.fatal) fatal = msg
      results.push(stub(lm, now, '오류', `${msg}${e?.retriesExhausted ? ' (3회 재시도 후 실패)' : ''}`))
      log(`${label} → 오류: ${msg}`)
    }
  }
  return { results, stats, fatal }
}

function stub(lm, now, status, reason) {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  return { row: { ...emptyRow(lm, today), 상태: status, 매칭검증사유: reason }, trades: [] }
}

function emptyRow(lm, today) {
  const row = Object.fromEntries(SUMMARY_HEADERS.map((h) => [h, null]))
  return Object.assign(row, {
    조회일: today, 시도: lm.sido ?? '', 시군구: lm.sigungu ?? '', 지역코드: lm.lawdCd ?? '', 시트단지명: lm.sheetText ?? lm.name,
    시트평형: lm.pyeong ?? lm.pyeongLabel ?? '', 매매건수: 0, 해제제외건수: 0, 전세건수: 0, 출처: SOURCE,
  })
}

export const SUMMARY_HEADERS = [
  '조회일', '시도', '시군구', '지역코드', '지역코드일치', '시트단지명', '시트평형',
  'API단지명', '단지매칭', '법정동', '준공연도', '블록구분', '면적기준', '선택전용타입', '면적후보',
  '매매가(억)', '매매가(원)', '매매계약일', '매매전용면적', '매매층', '매매거래유형', '매매조회기간', '매매건수', '해제제외건수',
  '전세가(억)', '전세가(원)', '전세계약일', '전세전용면적', '전세층', '전세계약구분', '전세조회기간', '전세건수',
  '전세가율(%)', '상태', '매칭검증사유', '거래주의사유', '출처',
]

export function selectLandmarks(all, args) {
  const only = args.indexOf('--only')
  if (only >= 0) {
    const q = args[only + 1] ?? ''
    return all.filter((l) => (l.sheetText ?? l.name).includes(q) || l.name.includes(q))
  }
  if (args.includes('--all')) return all.filter((l) => l.lawdCd)
  return all.filter((l) => l.top20 != null).sort((a, b) => a.top20 - b.top20)
}

async function main() {
  const args = process.argv.slice(2)
  let key
  try {
    key = loadServiceKey()
  } catch (e) {
    console.error(e.message)
    process.exit(1)
  }
  const scrub = (s) => String(s).split(key).join('***').split(encodeURIComponent(key)).join('***')
  const { landmarks: all } = JSON.parse(readFileSync(join(ROOT, 'server', 'landmarks.json'), 'utf8'))
  const targets = selectLandmarks(all, args)
  if (!targets.length) {
    console.error('조회할 단지가 없습니다. --only 이름을 확인하거나 landmarks.json 의 lawdCd 를 채워 주세요.')
    process.exit(1)
  }
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const outDir = join(ROOT, 'server', 'output')
  mkdirSync(outDir, { recursive: true })
  const logFile = join(outDir, `molit-batch-${stamp}.log`)
  const log = (m) => {
    const line = scrub(m)
    console.log(line)
    appendFileSync(logFile, line + '\n')
  }
  log(`국토부 실거래가 일괄 조회 시작: ${targets.length}개 단지 (매매·전세 각각 6→12→24개월)`)
  const useCache = !args.includes('--no-cache')
  const { results, stats, fatal } = await runBatch({
    landmarks: targets,
    fetcher: (kind, lawd, ym) => fetchMonth(kind, lawd, ym, key, { useCache }),
    now,
    log,
  })
  for (const r of results) r.row.매칭검증사유 = scrub(r.row.매칭검증사유 ?? '')

  const files = {
    summary: join(outDir, `molit-summary-${stamp}.csv`),
    trades: join(outDir, `molit-trades-${stamp}.csv`),
    app: join(outDir, `molit-app-import-${stamp}.csv`),
  }
  writeFileSync(files.summary, toCsv(results.map((r) => r.row), SUMMARY_HEADERS))
  const trades = results.flatMap((r) => r.trades)
  writeFileSync(files.trades, toCsv(trades, trades.length ? Object.keys(trades[0]) : ['시트단지명']))
  const app = appImportRows(results, all)
  writeFileSync(files.app, toCsv(app, APP_HEADERS))

  const count = (st) => results.filter((r) => r.row.상태 === st).length
  log('')
  log(`실제 API 호출 ${stats.requests}회 · 캐시 사용 ${stats.cacheHits}개월분`)
  log(`정상 ${count('정상')} · 거래 시점 주의 ${count('거래 시점 주의')} · 검증 필요 ${count('검증 필요')} · 일부 거래 없음 ${count('일부 거래 없음')} · 거래 없음 ${count('거래 없음')} · 단지명 확인 필요 ${count('단지명 확인 필요')} · 지역코드 확인 필요 ${count('지역코드 확인 필요')} · 오류 ${count('오류')} · 중단 ${count('중단')}`)
  if (fatal) log(`⚠ 일괄 조회를 멈췄습니다: ${scrub(fatal)} (한도 초과면 내일 다시 실행하세요. 받은 달은 캐시에 남아 다시 호출하지 않습니다)`)
  log(`요약 CSV: ${files.summary}`)
  log(`상세 거래 CSV: ${files.trades}`)
  log(`앱 가져오기용 CSV(정상 행만): ${files.app}`)
  log(`로그: ${logFile}`)
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) main()
