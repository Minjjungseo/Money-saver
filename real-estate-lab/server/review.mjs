/**
 * 검증용 리포트 (API 호출 없음 — server/.cache 에 이미 받아 둔 국토부 응답만 읽는다)
 *
 *   npm run molit:review -- --only 목동신시가지5단지
 *   npm run molit:review                      (대표 20개 전부)
 *
 * 단지마다 같은 시군구의 '비슷한 이름' API 단지를 모두 보여 준다:
 *   API 단지명 · 법정동 · 지번 · 도로명 · 단지일련번호 · 준공연도 · 전용면적 타입별 매매/전월세 건수 · 매매가 범위
 * 이 정보(국토부 공식 응답)를 건축물대장·입주자모집공고와 대조해서
 * landmarks.json 의 apiNames / areaMin / areaMax 를 직접 적는다. 이 스크립트는 아무 값도 고치지 않는다.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './molit.mjs'
import { areaClusters, clusterLabel, matchName, nameKeys, similarNames, typeWindow } from './match.mjs'
import { selectLandmarks, toCsv, toEok } from './batch.mjs'

const CACHE = join(ROOT, 'server', '.cache')

/** 캐시에서 한 시군구의 거래 전부 (매매·전월세) */
export function readRegionCache(lawdCd, dir = CACHE) {
  if (!existsSync(dir)) return { items: [], months: [] }
  const items = []
  const months = new Set()
  for (const f of readdirSync(dir)) {
    const m = /^(sale|rent)-(\d{5})-(\d{6})\.json$/.exec(f)
    if (!m || m[2] !== lawdCd) continue
    months.add(m[3])
    for (const it of JSON.parse(readFileSync(join(dir, f), 'utf8')).items) items.push({ ...it, kind: m[1], ym: m[3] })
  }
  return { items, months: [...months].sort() }
}

const uniq = (arr) => [...new Set(arr.filter((v) => v != null && v !== ''))].sort()

/** 한 랜드마크의 검토 행들: 비슷한 이름의 API 단지 × 면적 타입 */
export function reviewLandmark(lm, items) {
  const names = uniq(items.map((it) => it.aptName))
  const matched = matchName(lm, items)
  // 매칭된 이름 + 비슷한 이름(최대 8개)을 모두 보여 준다
  const shown = uniq([...matched.names, ...similarNames(lm.name, names, 8)])
  const win = typeWindow(lm)
  const rows = []
  for (const name of shown) {
    const mine = items.filter((it) => it.aptName === name)
    for (const c of areaClusters(mine)) {
      const inType = mine.filter((it) => it.area >= c.min && it.area <= c.max)
      const sales = inType.filter((it) => it.kind === 'sale' && !it.cancelled && it.priceWon != null)
      const prices = sales.map((it) => it.priceWon).sort((a, b) => a - b)
      rows.push({
        시트단지명: lm.sheetText ?? lm.name,
        시트평형: lm.pyeong ?? lm.pyeongLabel ?? '',
        지역코드: lm.lawdCd,
        현재매칭: matched.names.includes(name) ? matched.level : '',
        API단지명: name,
        법정동: uniq(mine.map((it) => it.dong)).join(' / '),
        지번: uniq(mine.map((it) => it.jibun)).join(' / '),
        도로명: uniq(mine.map((it) => it.roadNm)).join(' / '),
        단지일련번호: uniq(mine.map((it) => it.aptSeq)).join(' / '),
        준공연도: uniq(mine.map((it) => it.buildYear)).join(' / '),
        전용면적타입: clusterLabel(c),
        '평형 후보 범위 안': c.max >= win.min && c.min <= win.max ? 'Y' : '',
        매매건수: sales.length,
        전세건수: inType.filter((it) => it.kind === 'rent' && it.isJeonse).length,
        월세건수: inType.filter((it) => it.kind === 'rent' && !it.isJeonse).length,
        '매매가 최저(억)': toEok(prices[0] ?? null),
        '매매가 최고(억)': toEok(prices[prices.length - 1] ?? null),
        최근거래일: uniq(inType.map((it) => it.contractDate)).pop() ?? '',
      })
    }
  }
  return { rows, matched, names: shown }
}

function main() {
  const args = process.argv.slice(2)
  const { landmarks } = JSON.parse(readFileSync(join(ROOT, 'server', 'landmarks.json'), 'utf8'))
  const targets = selectLandmarks(landmarks, args)
  const all = []
  for (const lm of targets) {
    if (!lm.lawdCd) continue
    const { items, months } = readRegionCache(lm.lawdCd)
    const { rows } = reviewLandmark(lm, items)
    console.log(`\n■ ${lm.sheetText} (지역코드 ${lm.lawdCd}) — 캐시 ${months.length}개월분 ${items.length}건 (${months[0] ?? '-'}~${months[months.length - 1] ?? '-'})`)
    if (!items.length) console.log('  캐시에 이 지역 거래가 없습니다 → npm run molit:probe -- --lawd ' + lm.lawdCd)
    for (const r of rows) {
      console.log(`  ${r.현재매칭 ? '●' : '○'} ${r.API단지명} | ${r.법정동} ${r.지번} | 준공 ${r.준공연도} | ${r.전용면적타입}${r['평형 후보 범위 안'] ? ' ★' : ''} | 매매 ${r.매매건수}건 ${r['매매가 최저(억)'] ?? '-'}~${r['매매가 최고(억)'] ?? '-'}억 · 전세 ${r.전세건수} · 월세 ${r.월세건수}`)
    }
    all.push(...rows)
  }
  console.log('\n● = 현재 매칭된 API 단지명, ○ = 비슷한 이름(참고), ★ = 시트 평형으로 있을 수 있는 면적')
  const outDir = join(ROOT, 'server', 'output')
  mkdirSync(outDir, { recursive: true })
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const file = join(outDir, `molit-review-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.csv`)
  writeFileSync(file, toCsv(all, all.length ? Object.keys(all[0]) : ['시트단지명']))
  console.log(`검토 CSV: ${file}`)
}

if (process.argv[1] && /review\.mjs$/.test(process.argv[1])) main()
