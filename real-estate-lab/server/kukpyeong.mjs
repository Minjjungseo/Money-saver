/**
 * 국민평형(전용 84㎡대) 실거래가 비교 — 순수 함수 모음
 *
 * 기준
 *  - 비교 면적: 전용 84.0㎡ 이상 85.0㎡ 미만 (공급평형·시트 평형과 무관)
 *  - 최신 거래 + 최근 3개월 중위가격(표본 3건 미만이면 '표본 부족', 계산하지 않음)
 *  - 블록·API 단지명이 여러 개면 자동으로 합치지 않고 블록별 행으로 나눈다(그룹 = 시트 단지)
 *  - 84㎡대 거래가 24개월간 없으면 '국평 거래 없음' — 다른 면적으로 대체하지 않는다
 */

export const KUKPYEONG = { min: 84.0, maxExclusive: 85.0, label: '전용 84㎡대 (84.0㎡ 이상 85.0㎡ 미만)' }
export const RECENT_MONTHS = 3
export const MIN_SAMPLE = 3

export const isKukpyeong = (area) => area != null && Number.isFinite(area) && area >= KUKPYEONG.min && area < KUKPYEONG.maxExclusive

const pad = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** 중위값 (짝수 개면 가운데 두 값의 평균). 빈 배열은 null */
export function median(nums) {
  const a = nums.filter((n) => n != null && Number.isFinite(n)).sort((x, y) => x - y)
  if (!a.length) return null
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : Math.round((a[m - 1] + a[m]) / 2)
}

/** 최근 3개월 기준 기간: 오늘로부터 3개월 전 같은 날 ~ 오늘 */
export function recentWindow(now = new Date(), months = RECENT_MONTHS) {
  const from = new Date(now.getFullYear(), now.getMonth() - months, now.getDate())
  return { from: iso(from), to: iso(now), label: `${iso(from)}~${iso(now)}` }
}

/**
 * 중위가격 요약. 표본이 MIN_SAMPLE 미만이면 중위가격을 만들지 않는다.
 * @returns {{ medianWon: number|null, count: number, status: '정상'|'표본 부족', period: string }}
 */
export function recentMedian(trades, amountOf, now = new Date()) {
  const w = recentWindow(now)
  const inWin = trades.filter((t) => t.contractDate && t.contractDate >= w.from && t.contractDate <= w.to)
  const count = inWin.length
  if (count < MIN_SAMPLE) return { medianWon: null, count, status: `표본 부족(${count}건, ${MIN_SAMPLE}건 미만)`, period: w.label }
  return { medianWon: median(inWin.map(amountOf)), count, status: '정상', period: w.label }
}

/**
 * 거래 식별 키. 국토부 응답의 식별정보를 우선 쓴다.
 *  1) 단지일련번호(aptSeq)  2) 법정동+지번  3) 단지명 (식별정보가 가장 약함)
 * 국토부 실거래 응답에는 '거래 고유번호'가 없으므로 키가 같아도 서로 다른 거래일 수 있다.
 * → 한 응답(한 달치) 안에서 같은 키가 여러 번 나오면 합치지 않고 #2, #3 순번을 붙여 모두 남긴다.
 * → 같은 달을 다시 받으면 그 달 묶음을 통째로 새 응답으로 바꾼다(해제 신고 반영). 서로 다른 달끼리는 합치지 않는다.
 */
export function tradeKey(kind, it, lawdCd = '') {
  const place = it.aptSeq ? `seq:${it.aptSeq}` : it.jibun ? `jb:${it.dong ?? ''}-${it.jibun}` : `nm:${it.dong ?? ''}-${it.aptName}`
  const amount = kind === 'sale' ? `${it.priceWon ?? ''}` : `${it.depositWon ?? ''}/${it.monthlyWon ?? ''}`
  return [kind, it.sggCd || lawdCd, place, it.aptDong ?? '', it.contractDate ?? '', it.area ?? '', it.floor ?? '', amount, kind === 'rent' ? it.contractTerm ?? '' : ''].join('|')
}

export const idQuality = (it) => (it.aptSeq ? '단지일련번호' : it.jibun ? '지번' : '단지명만(식별 약함)')

/** 한 달치 거래에 tradeId 부여 (같은 키는 순번으로 구분, 절대 합치지 않음) */
export function assignTradeIds(kind, lawdCd, items) {
  const seen = new Map()
  return items.map((it) => {
    const key = tradeKey(kind, it, lawdCd)
    const n = (seen.get(key) ?? 0) + 1
    seen.set(key, n)
    return { ...it, tradeId: n === 1 ? key : `${key}#${n}`, idQuality: idQuality(it) }
  })
}

/**
 * 매칭된 API 단지명 → 블록 목록.
 *  - landmarks.json 에 blocks 가 있으면 그대로 (블록 이름·API명을 사람이 확인해 적은 것)
 *  - 없으면 API 단지명 하나 = 블록 하나 (자동으로 합치지 않음)
 */
export function splitBlocks(lm, matchedNames) {
  if (Array.isArray(lm.blocks) && lm.blocks.length) {
    return lm.blocks.map((b) => ({ label: b.label, names: b.apiNames ?? [], configured: true }))
  }
  if (matchedNames.length <= 1) return matchedNames.map((n) => ({ label: '', names: [n], configured: false }))
  return matchedNames.map((n) => {
    const m = /\(([^)]+)\)/.exec(n)
    return { label: m ? m[1] : n, names: [n], configured: false }
  })
}

/** 84㎡대 타입 목록: "84.95㎡(12건), 84.99㎡(7건)" */
export function kukpyeongTypes(trades) {
  const c = new Map()
  for (const t of trades) if (isKukpyeong(t.area)) c.set(t.area, (c.get(t.area) ?? 0) + 1)
  return [...c.entries()].sort((a, b) => a[0] - b[0]).map(([a, n]) => `${a}㎡(${n}건)`).join(', ')
}

/** 순위 포함 여부: 정상 또는 거래 시점 주의이면서 84㎡대 매매가 있는 행만 */
export const rankable = (row) => ['정상', '거래 시점 주의'].includes(row.상태) && row['매매 최신가(억)'] != null

/**
 * 국평 가격 순위. 3개월 중위 매매가가 있는 행을 먼저(높은 순), 표본 부족 행은 '참고'로 뒤에 최신 매매가 순.
 */
export function rankRows(rows) {
  const ok = rows.filter(rankable)
  const withMedian = ok.filter((r) => r['매매 3개월 중위(억)'] != null).sort((a, b) => b['매매 3개월 중위(억)'] - a['매매 3개월 중위(억)'])
  const thin = ok.filter((r) => r['매매 3개월 중위(억)'] == null).sort((a, b) => b['매매 최신가(억)'] - a['매매 최신가(억)'])
  return [
    ...withMedian.map((r, i) => ({ 순위: i + 1, 순위기준: '최근 3개월 중위 매매가', ...pickRank(r) })),
    ...thin.map((r) => ({ 순위: '참고', 순위기준: `표본 부족 → 최신 매매가 참고`, ...pickRank(r) })),
  ]
}

function pickRank(r) {
  return {
    그룹: r.그룹,
    블록: r.블록,
    시도: r.시도,
    시군구: r.시군구,
    '매매 3개월 중위(억)': r['매매 3개월 중위(억)'],
    '매매 3개월 건수': r['매매 3개월 건수'],
    '매매 최신가(억)': r['매매 최신가(억)'],
    매매계약일: r.매매계약일,
    '전세 3개월 중위(억)': r['전세 3개월 중위(억)'],
    '전세가율 3개월 중위(%)': r['전세가율 3개월 중위(%)'],
    상태: r.상태,
    기준기간: r.기준기간,
  }
}
