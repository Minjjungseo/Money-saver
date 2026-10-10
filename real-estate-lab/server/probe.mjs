/**
 * 지역코드 진단: 한 시군구·한 달의 국토부 응답 원문을 캐시 없이 직접 받아 보여 준다.
 *
 *   npm run molit:probe -- --lawd 29155              (지난달, 매매·전월세)
 *   npm run molit:probe -- --lawd 29155 --ym 202608
 *
 * 비교용으로 같은 시·도의 다른 시군구 코드(--compare 29140)를 함께 조회할 수 있다.
 * 인증키는 출력하지 않는다.
 */
import { ENDPOINTS, loadServiceKey, parseResponse, normalizeItem, recentMonths } from './molit.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const lawd = arg('lawd')
if (!/^\d{5}$/.test(lawd ?? '')) {
  console.error('사용법: npm run molit:probe -- --lawd 29155 [--ym 202609] [--compare 29140]')
  process.exit(1)
}
const ym = arg('ym', recentMonths(2)[1])
const compare = arg('compare')
let key
try {
  key = loadServiceKey()
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
const scrub = (s) => String(s).split(key).join('***').split(encodeURIComponent(key)).join('***')

for (const code of [lawd, compare].filter(Boolean)) {
  for (const kind of ['sale', 'rent']) {
    const qs = new URLSearchParams({ serviceKey: key, LAWD_CD: code, DEAL_YMD: ym, pageNo: '1', numOfRows: '10' })
    console.log(`\n■ ${kind === 'sale' ? '매매' : '전월세'} LAWD_CD=${code} DEAL_YMD=${ym}`)
    try {
      const res = await fetch(`${ENDPOINTS[kind]}?${qs}`, { signal: AbortSignal.timeout(30_000) })
      const xml = await res.text()
      console.log(`  HTTP ${res.status}`)
      console.log(`  응답 원문 앞부분: ${scrub(xml.replace(/\s+/g, ' ').slice(0, 500))}`)
      const p = parseResponse(xml)
      if (!p.ok) {
        console.log(`  → 오류 응답: ${scrub(p.error)}`)
        continue
      }
      const items = p.items.map((o) => normalizeItem(kind, o))
      console.log(`  → totalCount ${p.totalCount}, 이번 페이지 ${items.length}건`)
      console.log(`  → 응답 지역코드(sggCd): ${[...new Set(items.map((it) => it.sggCd))].join(', ') || '(없음)'}`)
      console.log(`  → 법정동: ${[...new Set(items.map((it) => it.dong))].join(', ') || '(없음)'}`)
      console.log(`  → 단지명 예: ${[...new Set(items.map((it) => it.aptName))].slice(0, 8).join(', ') || '(없음)'}`)
    } catch (e) {
      console.log(`  → 요청 실패: ${scrub(e.message)}`)
    }
  }
}
