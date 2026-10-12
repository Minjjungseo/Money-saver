/**
 * 국평(전용 84㎡대) 실거래가 일괄 비교 → CSV
 *
 *   npm run molit:kukpyeong -- --cache-only     이미 받아 둔 캐시만 사용 (API 호출 0회, 캐시에 없는 달은 '캐시 부족')
 *   npm run molit:kukpyeong                     대표 20개 (필요한 달만 API 호출)
 *   npm run molit:kukpyeong -- --only 송도
 *
 * 출력 (server/output, 실행마다 새 파일 — 기존 파일·시트·앱 데이터는 건드리지 않음)
 *   molit-kukpyeong-summary-*.csv   단지 × 블록 1행: 최신가, 최근 3개월 중위가·건수·기준기간, 84㎡대 타입, 상태
 *   molit-kukpyeong-trades-*.csv    84㎡대 거래 상세 (tradeId 포함)
 *   molit-kukpyeong-ranking-*.csv   국평 가격 순위 (정상·거래 시점 주의만, 국평 거래 없음 등은 제외)
 * 원장: server/data/trades/ (월별 국토부 응답 + tradeId, 바뀌면 history/ 에 이전본 보관)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ROOT, fetchMonth, loadServiceKey, recentMonths } from './molit.mjs'
import { matchName, similarNames } from './match.mjs'
import { retiredCodeNote } from './lawd.mjs'
import { PERIODS, SOURCE, selectLandmarks, toCsv, toEok } from './batch.mjs'
import { KUKPYEONG, isKukpyeong, kukpyeongTypes, rankRows, rankable, recentMedian, recentWindow, splitBlocks } from './kukpyeong.mjs'
import { saveMonth } from './ledger.mjs'

const DATE_GAP_WARN_DAYS = 90
const STALE_MONTHS = 6
const pad = (n) => String(n).padStart(2, '0')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const uniq = (arr) => [...new Set(arr.filter((v) => v != null && v !== ''))].sort()
const daysBetween = (a, b) => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000)
const monthsAgo = (date, now) => {
  const d = new Date(date)
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}
const byDateDesc = (a, b) => (b.contractDate ?? '').localeCompare(a.contractDate ?? '') || (b.floor ?? 0) - (a.floor ?? 0)
const nameLevelLabel = { exact: '일치', alias: '일치(직접 지정한 이름)', partial: '부분 일치', none: '못 찾음' }

const saleUsable = (it) => !it.cancelled && it.priceWon != null
const jeonseUsable = (it) => it.isJeonse && it.depositWon != null
const isRenewal = (it) => /갱신/.test(it.contractType ?? '')

export const KUKPYEONG_HEADERS = [
  '조회일', '그룹', '블록', '시도', '시군구', '지역코드', '지역코드일치', '시트평형(참고)', 'API단지명', '단지매칭', '법정동', '지번', '준공연도',
  '비교기준', '국평타입(실제 전용)', '기준기간',
  '매매 최신가(억)', '매매 최신가(원)', '매매계약일', '매매전용면적', '매매층', '매매거래유형', '매매조회기간', '매매건수', '해제제외건수',
  '매매 3개월 중위(억)', '매매 3개월 건수', '매매 3개월 표본',
  '전세 최신가(억)', '전세 최신가(원)', '전세계약일', '전세전용면적', '전세층', '전세계약구분', '전세조회기간', '전세건수',
  '전세 3개월 중위(억)', '전세 3개월 건수(신규)', '전세 3개월 갱신건수', '전세 3개월 표본',
  '전세가율 최신(%)', '전세가율 3개월 중위(%)',
  '상태', '순위포함', '매칭검증사유', '거래주의사유', '출처',
]

function baseRow(lm, today) {
  const row = Object.fromEntries(KUKPYEONG_HEADERS.map((h) => [h, null]))
  return Object.assign(row, {
    조회일: today, 그룹: lm.sheetText ?? lm.name, 블록: '', 시도: lm.sido ?? '', 시군구: lm.sigungu ?? '', 지역코드: lm.lawdCd ?? '',
    '시트평형(참고)': lm.pyeong ?? lm.pyeongLabel ?? '', 비교기준: KUKPYEONG.label, 매매건수: 0, 해제제외건수: 0, 전세건수: 0, 출처: SOURCE,
  })
}

/**
 * 한 시트 단지 → 블록별 행들.
 * 매매·전세 각각, 모든 블록에 84㎡대 거래가 잡힐 때까지 6 → 12 → 24개월로 독립적으로 넓힌다.
 */
export async function lookupKukpyeong(lm, { getMonth, now = new Date() }) {
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const head = baseRow(lm, today)
  if (!lm.lawdCd) {
    return { rows: [{ ...head, 상태: '지역코드 없음', 순위포함: 'N', 매칭검증사유: 'landmarks.json 에 lawdCd 가 없음' }], trades: [] }
  }
  const months = recentMonths(24, now)
  const region = { sale: [], rent: [] }
  const fetched = { sale: 0, rent: 0 }
  const missingMonths = new Set()
  const extend = async (kind, upto) => {
    for (const ym of months.slice(fetched[kind], upto)) {
      const r = await getMonth(kind, lm.lawdCd, ym)
      if (r.missing) missingMonths.add(`${kind === 'sale' ? '매매' : '전월세'} ${ym}`)
      region[kind].push(...r.items.map((it) => ({ ...it, ym })))
    }
    fetched[kind] = Math.max(fetched[kind], upto)
  }
  await extend('sale', PERIODS[0])
  await extend('rent', PERIODS[0])

  let name
  let blocks
  for (;;) {
    name = matchName(lm, [...region.sale, ...region.rent])
    blocks = splitBlocks(lm, name.names)
    let grew = false
    for (const kind of ['sale', 'rent']) {
      const usable = kind === 'sale' ? saleUsable : jeonseUsable
      const lacking = !blocks.length || blocks.some((b) => !region[kind].some((it) => b.names.includes(it.aptName) && isKukpyeong(it.area) && usable(it)))
      const next = PERIODS.find((p) => p > fetched[kind])
      if (lacking && next) {
        await extend(kind, next)
        grew = true
      }
    }
    if (!grew) break
  }

  const all = [...region.sale, ...region.rent]
  const coded = all.filter((it) => /^\d{5}$/.test(String(it.sggCd ?? '')))
  const same = coded.filter((it) => it.sggCd === lm.lawdCd).length
  head.지역코드일치 = coded.length ? `${Math.round((same / coded.length) * 100)}% (${coded.length}건 중 ${same})` : all.length ? '응답에 지역코드 없음' : '거래 0건'
  const cacheNote = missingMonths.size ? `캐시에 없는 달 ${missingMonths.size}개(${[...missingMonths].slice(0, 4).join(', ')}${missingMonths.size > 4 ? '…' : ''}) → 캐시 없이 다시 실행 필요` : ''

  if (all.length === 0 || (coded.length && same / coded.length < 0.5)) {
    const note = retiredCodeNote(lm.lawdCd)
    const status = all.length === 0 && missingMonths.size ? '캐시 부족' : '지역코드 확인 필요'
    return {
      rows: [{ ...head, 상태: status, 순위포함: 'N', 매칭검증사유: [all.length ? `응답 지역코드 대부분 ${uniq(coded.filter((it) => it.sggCd !== lm.lawdCd).map((it) => it.sggCd)).join(', ')}` : `24개월 거래 0건${note ? ` (${note})` : ''}`, cacheNote].filter(Boolean).join(' / ') }],
      trades: [],
    }
  }
  if (name.level === 'none') {
    const sim = similarNames(lm.name, all.map((it) => it.aptName))
    return {
      rows: [{ ...head, 상태: missingMonths.size ? '캐시 부족' : '단지명 확인 필요', 순위포함: 'N', 단지매칭: nameLevelLabel.none, 매칭검증사유: [sim.length ? `비슷한 API 단지명: ${sim.join(', ')}` : '같은/비슷한 이름 없음', cacheNote].filter(Boolean).join(' / ') }],
      trades: [],
    }
  }

  const rows = []
  const trades = []
  for (const b of blocks) {
    const row = { ...head, 블록: b.label, API단지명: b.names.join(' / '), 단지매칭: nameLevelLabel[name.level] }
    const mine = all.filter((it) => b.names.includes(it.aptName))
    const dongs = uniq(mine.map((it) => it.dong))
    row.법정동 = dongs.join(' / ')
    row.지번 = uniq(mine.map((it) => it.jibun)).join(' / ')
    row.준공연도 = uniq(mine.map((it) => it.buildYear)).join(' / ')
    const match = []
    const caution = []
    if (name.level === 'partial') match.push(`단지명 부분 일치(API: ${b.names.join(', ')}) — 같은 단지인지 확인`)
    if (dongs.length > 1) match.push(`같은 블록 안에 법정동 여러 개(${dongs.join(', ')})`)
    if (b.configured && !mine.length) match.push('landmarks.json blocks 의 API명이 응답에 없음')
    if (!b.configured && blocks.length > 1) row.블록 = `${b.label} (자동 분리: API 단지명 기준)`
    const hasOverride = (lm.apiNames?.length ?? 0) > 0 || (lm.blocks?.length ?? 0) > 0
    if (hasOverride && !lm.verified?.source) match.push('landmarks.json 직접 지정 값(apiNames/blocks)에 확인 출처(verified.source)가 없음')
    if (lm.checkNote) match.push(`확인할 것: ${lm.checkNote}`)

    const kp = mine.filter((it) => isKukpyeong(it.area))
    row['국평타입(실제 전용)'] = kukpyeongTypes(kp)
    const saleAll = region.sale.filter((it) => b.names.includes(it.aptName) && isKukpyeong(it.area))
    const jeonse = region.rent.filter((it) => b.names.includes(it.aptName) && isKukpyeong(it.area) && jeonseUsable(it)).sort(byDateDesc)
    const salesOk = saleAll.filter(saleUsable).sort(byDateDesc)

    if (!salesOk.length && !jeonse.length) {
      const other = uniq(mine.filter((it) => !isKukpyeong(it.area)).map((it) => it.area)).slice(0, 8)
      row.상태 = missingMonths.size ? '캐시 부족' : '국평 거래 없음'
      row.순위포함 = 'N'
      row.매칭검증사유 = match.join(' / ')
      row.거래주의사유 = [`${fetched.sale}개월간 전용 84㎡대 매매·전세 없음${other.length ? ` (다른 면적 거래: ${other.join(', ')}㎡ — 대체하지 않음)` : ''}`, cacheNote].filter(Boolean).join(' / ')
      rows.push(row)
      continue
    }

    const win = recentWindow(now)
    row.기준기간 = `최근 3개월 ${win.label} (신고기한 30일로 최근 1개월은 덜 집계될 수 있음)`
    // 매매
    const s = salesOk[0] ?? null
    row.매매건수 = salesOk.length
    row.해제제외건수 = saleAll.filter((it) => it.cancelled).length
    row.매매조회기간 = `최근 ${fetched.sale}개월`
    if (s) {
      Object.assign(row, { '매매 최신가(억)': toEok(s.priceWon), '매매 최신가(원)': s.priceWon, 매매계약일: s.contractDate, 매매전용면적: s.area, 매매층: s.floor, 매매거래유형: s.dealingType ?? '' })
      const ago = monthsAgo(s.contractDate, now)
      if (ago > STALE_MONTHS) caution.push(`최신 국평 매매가 ${ago}개월 전`)
      if (/직거래/.test(s.dealingType ?? '')) caution.push('최신 매매가 직거래')
    }
    const sm = recentMedian(salesOk, (t) => t.priceWon, now)
    Object.assign(row, { '매매 3개월 중위(억)': toEok(sm.medianWon), '매매 3개월 건수': sm.count, '매매 3개월 표본': sm.status })
    // 전세 (최신은 신규 우선, 중위는 신규·구분없음만 — 갱신은 인상 상한 때문에 따로 셈)
    const j = jeonse.find((it) => !isRenewal(it)) ?? jeonse[0] ?? null
    row.전세건수 = jeonse.length
    row.전세조회기간 = `최근 ${fetched.rent}개월`
    if (j) {
      Object.assign(row, { '전세 최신가(억)': toEok(j.depositWon), '전세 최신가(원)': j.depositWon, 전세계약일: j.contractDate, 전세전용면적: j.area, 전세층: j.floor, 전세계약구분: j.contractType ?? '' })
      const ago = monthsAgo(j.contractDate, now)
      if (ago > STALE_MONTHS) caution.push(`최신 국평 전세가 ${ago}개월 전`)
      if (isRenewal(j)) caution.push('국평 전세가 갱신 계약뿐(시세보다 낮을 수 있음)')
    }
    const jm = recentMedian(jeonse.filter((it) => !isRenewal(it)), (t) => t.depositWon, now)
    Object.assign(row, {
      '전세 3개월 중위(억)': toEok(jm.medianWon),
      '전세 3개월 건수(신규)': jm.count,
      '전세 3개월 갱신건수': jeonse.filter((it) => isRenewal(it) && it.contractDate >= win.from).length,
      '전세 3개월 표본': jm.status,
    })
    // 전세가율
    if (s && j) {
      row['전세가율 최신(%)'] = Number(((j.depositWon / s.priceWon) * 100).toFixed(1))
      const gap = daysBetween(s.contractDate, j.contractDate)
      if (gap > DATE_GAP_WARN_DAYS) caution.push(`최신 매매·전세 계약일 차이 ${gap}일`)
    }
    if (sm.medianWon && jm.medianWon) row['전세가율 3개월 중위(%)'] = Number(((jm.medianWon / sm.medianWon) * 100).toFixed(1))

    const missing = []
    if (!s) missing.push(`국평 매매 없음(${fetched.sale}개월)`)
    if (!j) missing.push(`국평 전세 없음(${fetched.rent}개월)`)
    if (cacheNote) missing.push(cacheNote)
    row.매칭검증사유 = match.join(' / ')
    row.거래주의사유 = [...caution, ...missing].join(' / ')
    if (match.length) row.상태 = '검증 필요'
    else if (missingMonths.size && (!s || !j)) row.상태 = '캐시 부족'
    else if (caution.length) row.상태 = '거래 시점 주의'
    else if (!s || !j) row.상태 = '일부 거래 없음'
    else row.상태 = '정상'
    row.순위포함 = rankable(row) ? 'Y' : 'N'
    rows.push(row)

    for (const it of [...saleAll.map((t) => ({ t, k: '매매' })), ...jeonse.map((t) => ({ t, k: '전세' }))].sort((a, b) => byDateDesc(a.t, b.t))) {
      trades.push({
        그룹: row.그룹, 블록: row.블록, 구분: it.k, API단지명: it.t.aptName, 법정동: it.t.dong ?? '', 지번: it.t.jibun ?? '', 단지일련번호: it.t.aptSeq ?? '',
        전용면적: it.t.area, 층: it.t.floor, 계약일: it.t.contractDate,
        '금액(억)': toEok(it.k === '매매' ? it.t.priceWon : it.t.depositWon), '금액(원)': it.k === '매매' ? it.t.priceWon : it.t.depositWon,
        해제여부: it.t.cancelled ? '해제' : '', 해제사유발생일: it.t.cancelDate ?? '', 거래유형: it.t.dealingType ?? '', 계약구분: it.t.contractType ?? '',
        '최근3개월': it.t.contractDate >= win.from ? 'Y' : '', 요약에사용: it.t === s || it.t === j ? 'Y' : '',
      })
    }
  }
  return { rows, trades }
}

/** 캐시만 읽는 조회 함수 (나이 무관). 없는 달은 missing 으로 표시 — 거래 0건과 구분 */
export function cacheOnlyFetcher(cacheDir = join(ROOT, 'server', '.cache')) {
  return async (kind, lawdCd, ym) => {
    const f = join(cacheDir, `${kind}-${lawdCd}-${ym}.json`)
    if (!existsSync(f)) return { kind, lawdCd, ym, items: [], missing: true, fromCache: true }
    return { ...JSON.parse(readFileSync(f, 'utf8')), fromCache: true }
  }
}

export async function runKukpyeong({ landmarks, fetcher, now = new Date(), gapMs = 150, log = console.log }) {
  const memo = new Map()
  const stats = { requests: 0, cacheHits: 0, missing: 0 }
  let fatal = null
  const getMonth = async (kind, lawdCd, ym) => {
    const k = `${kind}-${lawdCd}-${ym}`
    if (memo.has(k)) return memo.get(k)
    const r = await fetcher(kind, lawdCd, ym)
    if (r.missing) stats.missing++
    else if (r.fromCache) stats.cacheHits++
    else {
      stats.requests += r.requests ?? 1
      if (gapMs) await sleep(gapMs)
    }
    memo.set(k, r)
    return r
  }
  const rows = []
  const trades = []
  for (const [i, lm] of landmarks.entries()) {
    const label = `[${i + 1}/${landmarks.length}] ${lm.sheetText ?? lm.name}`
    if (fatal) {
      rows.push({ ...baseRow(lm, now.toISOString().slice(0, 10)), 상태: '중단', 순위포함: 'N', 매칭검증사유: `앞 단지에서 멈춤: ${fatal}` })
      continue
    }
    try {
      const r = await lookupKukpyeong(lm, { getMonth, now })
      rows.push(...r.rows)
      trades.push(...r.trades)
      for (const x of r.rows) log(`${label}${x.블록 ? ` [${x.블록}]` : ''} → ${x.상태}  매매 ${x['매매 최신가(억)'] ?? '-'}억 (3개월 중위 ${x['매매 3개월 중위(억)'] ?? x['매매 3개월 표본'] ?? '-'})  전세 ${x['전세 최신가(억)'] ?? '-'}억  타입 ${x['국평타입(실제 전용)'] || '-'}`)
    } catch (e) {
      const msg = e?.message ?? String(e)
      if (e?.fatal) fatal = msg
      rows.push({ ...baseRow(lm, now.toISOString().slice(0, 10)), 상태: '오류', 순위포함: 'N', 매칭검증사유: msg })
      log(`${label} → 오류: ${msg}`)
    }
  }
  return { rows, trades, ranking: rankRows(rows), stats, fatal, months: [...memo.values()] }
}

async function main() {
  const args = process.argv.slice(2)
  const cacheOnly = args.includes('--cache-only')
  let key = ''
  if (!cacheOnly) {
    try {
      key = loadServiceKey()
    } catch (e) {
      console.error(e.message)
      process.exit(1)
    }
  }
  const scrub = (s) => (key ? String(s).split(key).join('***').split(encodeURIComponent(key)).join('***') : String(s))
  const { landmarks: all } = JSON.parse(readFileSync(join(ROOT, 'server', 'landmarks.json'), 'utf8'))
  const targets = selectLandmarks(all, args)
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const outDir = join(ROOT, 'server', 'output')
  mkdirSync(outDir, { recursive: true })
  const logFile = join(outDir, `molit-kukpyeong-${stamp}.log`)
  const log = (m) => {
    const line = scrub(m)
    console.log(line)
    appendFileSync(logFile, line + '\n')
  }
  log(`국평(${KUKPYEONG.label}) 비교 시작: ${targets.length}개 단지${cacheOnly ? ' — 캐시만 사용(API 호출 없음)' : ''}`)
  const fetcher = cacheOnly ? cacheOnlyFetcher() : (kind, lawd, ym) => fetchMonth(kind, lawd, ym, key, { useCache: !args.includes('--no-cache') })
  const res = await runKukpyeong({ landmarks: targets, fetcher, now, gapMs: cacheOnly ? 0 : 150, log })
  for (const r of res.rows) r.매칭검증사유 = scrub(r.매칭검증사유 ?? '')

  // 원장 저장 (API에서 실제로 받은 달만; 캐시 전용 실행에서는 캐시 내용을 원장에 옮겨 둠)
  const ledgerDir = join(ROOT, 'server', 'data', 'trades')
  const ledger = { new: 0, updated: 0, same: 0 }
  for (const m of res.months) if (!m.missing && m.items) ledger[saveMonth(ledgerDir, m, now)]++

  const files = {
    summary: join(outDir, `molit-kukpyeong-summary-${stamp}.csv`),
    trades: join(outDir, `molit-kukpyeong-trades-${stamp}.csv`),
    ranking: join(outDir, `molit-kukpyeong-ranking-${stamp}.csv`),
  }
  writeFileSync(files.summary, toCsv(res.rows, KUKPYEONG_HEADERS))
  writeFileSync(files.trades, toCsv(res.trades, res.trades.length ? Object.keys(res.trades[0]) : ['그룹']))
  writeFileSync(files.ranking, toCsv(res.ranking, res.ranking.length ? Object.keys(res.ranking[0]) : ['순위']))

  const count = (st) => res.rows.filter((r) => r.상태 === st).length
  const statuses = ['정상', '거래 시점 주의', '일부 거래 없음', '검증 필요', '국평 거래 없음', '단지명 확인 필요', '지역코드 확인 필요', '캐시 부족', '오류', '중단']
  log('')
  log(`행 ${res.rows.length}개 (단지 ${targets.length}개, 블록 분리 포함) · 순위 포함 ${res.rows.filter((r) => r.순위포함 === 'Y').length}개`)
  log(statuses.map((s) => `${s} ${count(s)}`).join(' · '))
  log(`API 호출 ${res.stats.requests}회 · 캐시 ${res.stats.cacheHits}개월분${res.stats.missing ? ` · 캐시에 없는 달 ${res.stats.missing}개` : ''}`)
  log(`원장(server/data/trades): 새로 ${ledger.new} · 갱신 ${ledger.updated}(이전본 history/ 보관) · 변화 없음 ${ledger.same}`)
  if (res.fatal) log(`⚠ 멈춤: ${scrub(res.fatal)}`)
  log(`요약: ${files.summary}`)
  log(`거래 상세: ${files.trades}`)
  log(`순위: ${files.ranking}`)
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) main()
