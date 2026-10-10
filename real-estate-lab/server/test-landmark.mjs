/**
 * 한 단지 실제 API 연결 테스트 (기본: 서울 서초구 아크로리버파크, 전용 80~90㎡)
 *
 *   npm run molit:test
 *   npm run molit:test -- --name 잠실엘스 --lawd 11710 --min 80 --max 90
 *
 * 최근 6개월 → 거래가 없으면 12개월 → 24개월까지 넓혀서 찾는다.
 * 해제(취소)된 매매는 최신가 계산에서 빼고 따로 보여준다. 전세는 월세 0원 계약만.
 */
import { fetchMonth, loadServiceKey, recentMonths, squashName } from './molit.mjs'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const NAME = arg('name', '아크로리버파크')
const LAWD = arg('lawd', '11650') // 서울 서초구
const MIN = Number(arg('min', '80'))
const MAX = Number(arg('max', '90'))
const eok = (w) => (w == null ? '-' : `${(w / 1e8).toFixed(2)}억`)

let key
try {
  key = loadServiceKey()
} catch (e) {
  console.error(`\n✗ ${e.message}\n`)
  process.exit(1)
}
console.log(`\n[MY REAL ESTATE LAB] 국토교통부 실거래가 연결 테스트`)
console.log(`단지: ${NAME} / 지역코드: ${LAWD} / 전용면적: ${MIN}~${MAX}㎡ / 조회일: ${new Date().toLocaleString('ko-KR')}\n`)

const target = squashName(NAME)
let sales = []
let rents = []
let months = []
let namesSeen = new Set()
for (const span of [6, 12, 24]) {
  months = recentMonths(span)
  sales = []
  rents = []
  for (const ym of months) {
    for (const kind of ['sale', 'rent']) {
      try {
        const r = await fetchMonth(kind, LAWD, ym, key)
        if (ym === months[0] && kind === 'sale') console.log(`(응답 확인용 원문 일부) ${r.sampleRaw.replace(/\s+/g, ' ').slice(0, 200)}…\n`)
        for (const it of r.items) {
          namesSeen.add(it.aptName)
          if (!squashName(it.aptName).includes(target)) continue
          if (it.area == null || it.area < MIN || it.area > MAX) continue
          ;(kind === 'sale' ? sales : rents).push(it)
        }
      } catch (e) {
        console.error(`✗ ${kind === 'sale' ? '매매' : '전월세'} ${ym} 조회 실패: ${e.message}`)
        if (e.raw) console.error(`  응답 원문: ${e.raw}`)
        console.error(
          '  흔한 원인: ① 활용신청 승인 직후(반영까지 1~2시간) ② 인증키 오타 ③ 두 API 중 하나만 신청됨 ④ 인코딩/디코딩 키 혼동(.env.local 에는 Decoding 키 권장)',
        )
        process.exit(1)
      }
    }
  }
  if (sales.length || rents.some((r) => r.isJeonse)) break
  console.log(`최근 ${span}개월에 ${NAME} ${MIN}~${MAX}㎡ 거래가 없어 기간을 넓힙니다…`)
}

const byDate = (a, b) => (b.contractDate ?? '').localeCompare(a.contractDate ?? '')
const valid = sales.filter((s) => !s.cancelled).sort(byDate)
const cancelled = sales.filter((s) => s.cancelled).sort(byDate)
const jeonse = rents.filter((r) => r.isJeonse).sort(byDate)

console.log(`조회 기간: ${months.at(-1)} ~ ${months[0]} (${months.length}개월)`)
console.log(`\n■ 매매 실거래 (해제 제외) ${valid.length}건`)
for (const s of valid.slice(0, 10)) console.log(`  ${s.contractDate}  전용 ${s.area}㎡  ${s.floor}층  ${eok(s.priceWon)}  (${s.aptName}, ${s.dong ?? ''})`)
if (cancelled.length) {
  console.log(`\n■ 해제(취소)된 매매 ${cancelled.length}건 — 최신가 계산에서 제외`)
  for (const s of cancelled.slice(0, 5)) console.log(`  ${s.contractDate}  전용 ${s.area}㎡  ${s.floor}층  ${eok(s.priceWon)}  해제일 ${s.cancelDate ?? '-'}`)
}
console.log(`\n■ 전세 실거래 (월세 0원) ${jeonse.length}건`)
for (const r of jeonse.slice(0, 10)) console.log(`  ${r.contractDate}  전용 ${r.area}㎡  ${r.floor}층  보증금 ${eok(r.depositWon)}  ${r.contractType ?? ''}`)

// 같은 면적끼리 최신 매매·전세 비교
const latestSale = valid[0] ?? null
const sameAreaJeonse = latestSale ? jeonse.find((r) => Math.abs(r.area - latestSale.area) < 0.5) ?? null : null
console.log('\n■ 요약')
console.log(`  매매 최근 실거래가: ${latestSale ? `${eok(latestSale.priceWon)} (${latestSale.contractDate}, ${latestSale.floor}층, 전용 ${latestSale.area}㎡)` : '거래 없음'}`)
console.log(`  전세 최근 실거래가(같은 면적): ${sameAreaJeonse ? `${eok(sameAreaJeonse.depositWon)} (${sameAreaJeonse.contractDate}, ${sameAreaJeonse.floor}층)` : '거래 없음'}`)
console.log(`  전세가율: ${latestSale && sameAreaJeonse ? ((sameAreaJeonse.depositWon / latestSale.priceWon) * 100).toFixed(1) + '%' : '계산 불가'}`)
console.log('  ※ 최근 1~2개월은 신고 기한(계약 후 30일)과 공개 지연으로 거래가 덜 잡힐 수 있습니다. 정정·해제로 값이 바뀔 수 있습니다.')

if (!valid.length && !jeonse.length) {
  const similar = [...namesSeen].filter((n) => squashName(n).includes(target.slice(0, 3))).slice(0, 10)
  console.log(`\n이 지역에서 비슷한 단지명: ${similar.length ? similar.join(', ') : '없음'} — 단지명 표기가 다를 수 있습니다 (검증 필요)`)
}
console.log('')
