/**
 * 지역코드 진단: 한 시군구·한 달의 국토부 응답 원문을 캐시 없이 직접 받아 보여 준다.
 *
 *   npm run molit:probe -- --lawd 29155                       (지난달, 매매·전월세)
 *   npm run molit:probe -- --lawd 29155,12270 --ym 202606,202609
 *   npm run molit:probe -- --lawd 12270 --compare 11650       (정상 조회되던 코드와 비교)
 *
 * --lawd / --compare / --ym 은 쉼표로 여러 개를 줄 수 있다.
 * 실제 전송하는 엔드포인트와 파라미터를 함께 보여 준다. 인증키 값은 출력하지 않는다(길이·상태만).
 */
import { ENDPOINTS, loadServiceKey, parseResponse, normalizeItem, recentMonths } from './molit.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const list = (v) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : [])
const codes = [...list(arg('lawd')), ...list(arg('compare'))]
const yms = list(arg('ym', recentMonths(2)[1]))
if (!codes.length || codes.some((c) => !/^\d{5}$/.test(c)) || yms.some((m) => !/^\d{6}$/.test(m))) {
  console.error('사용법: npm run molit:probe -- --lawd 29155[,12270] [--ym 202606,202609] [--compare 11650]')
  console.error('  지역코드는 숫자 5자리(법정동코드 앞 5자리), 조회월은 YYYYMM 6자리')
  process.exit(1)
}
let key
try {
  key = loadServiceKey()
} catch (e) {
  console.error(e.message)
  process.exit(1)
}
const scrub = (s) => String(s).split(key).join('***').split(encodeURIComponent(key)).join('***')

// 요청 방식 점검용 (키 값은 숨김)
console.log('■ 요청 방식')
console.log(`  매매 엔드포인트: ${ENDPOINTS.sale}`)
console.log(`  전월세 엔드포인트: ${ENDPOINTS.rent}`)
console.log('  파라미터: serviceKey, LAWD_CD(5자리), DEAL_YMD(YYYYMM), pageNo, numOfRows')
console.log(`  인증키: ${key.length}자, ${/%[0-9A-Fa-f]{2}/.test(key) ? '인코딩된 상태(⚠ 이중 인코딩 위험)' : '디코딩된 상태'} → 전송 시 URL 인코딩 1회`)

let row = 0
for (const code of codes) for (const ym of yms) {
  for (const kind of ['sale', 'rent']) {
    const qs = new URLSearchParams({ serviceKey: key, LAWD_CD: code, DEAL_YMD: ym, pageNo: '1', numOfRows: '10' })
    if (row++ === 0) console.log(`  실제 요청 예: ${ENDPOINTS[kind]}?${qs.toString().replace(/serviceKey=[^&]*/, 'serviceKey=***')}`)
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
