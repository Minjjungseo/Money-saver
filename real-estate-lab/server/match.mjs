/**
 * 시트 랜드마크 ↔ 국토부 거래 매칭 규칙 (순수 함수, 테스트 대상)
 *
 * 단지명
 *  - 'exact'   : 공백·괄호·'아파트' 제거 + 영문 표기 통일(SK→에스케이 등) 후 같음 → 확실
 *  - 'alias'   : landmarks.json 에 사용자가 확인해 적은 apiNames 와 같음 → 확실
 *  - 'partial' : 한쪽 이름이 다른 쪽에 포함됨 → 검증 필요
 *  - 'none'    : 일치 없음
 * 전용면적
 *  - 시트는 평형(공급면적)만 있으므로 33~35평 → 전용 84㎡대(83~86㎡)로 본다(표준 매칭).
 *  - 그 밖의 평형은 범위를 넓게 잡고 '검증 필요'.
 *  - landmarks.json 에 areaMin/areaMax 를 직접 적으면 그 범위를 확실한 기준으로 쓴다.
 */

const LETTERS = [
  [/sk/g, '에스케이'],
  [/ipark/g, '아이파크'],
  [/e편한세상/g, 'e편한세상'],
  [/dmc/g, '디엠씨'],
  [/the/g, '더'],
  [/xi/g, '자이'],
  [/s클래스/g, '에스클래스'],
  [/kcc/g, '케이씨씨'],
  [/lh/g, '엘에이치'],
]

/** 비교용 단지명 정규화 */
export function normName(s) {
  let t = String(s ?? '').toLowerCase()
  t = t.replace(/\(.*?\)/g, '') // 괄호 내용(블록·평형 등) 제거
  t = t.replace(/아파트|apt/g, '')
  t = t.replace(/[\s·.,\-_'"]/g, '')
  for (const [re, to] of LETTERS) t = t.replace(re, to)
  return t
}

/**
 * 한 지역의 거래들에서 랜드마크 단지명과 맞는 API 단지명을 고른다.
 * 시트 이름이 "이촌동 한가람"처럼 법정동으로 시작하면, 같은 법정동의 "한가람"도 exact 로 본다.
 * @param {{name: string, apiNames?: string[]}} landmark
 * @param {{aptName: string, dong?: string|null}[]} items
 * @returns {{ level: 'exact'|'alias'|'partial'|'none', names: string[] }}
 */
export function matchName(landmark, items) {
  const pairs = new Map()
  for (const it of items) pairs.set(`${it.aptName}|${it.dong ?? ''}`, it)
  const list = [...pairs.values()]
  const uniq = (arr) => [...new Set(arr.map((x) => x.aptName))]
  const aliases = (landmark.apiNames ?? []).map(normName)
  const target = normName(landmark.name)
  const aliasHits = list.filter((x) => aliases.includes(normName(x.aptName)))
  if (aliasHits.length) return { level: 'alias', names: uniq(aliasHits) }
  const dongPrefix = /^(\S+동)\s+(.+)$/.exec(String(landmark.name).trim())
  const exact = list.filter(
    (x) => normName(x.aptName) === target || (dongPrefix && x.dong === dongPrefix[1] && normName(x.aptName) === normName(dongPrefix[2])),
  )
  if (exact.length) return { level: 'exact', names: uniq(exact) }
  if (target.length >= 3) {
    const partial = list.filter((x) => {
      const a = normName(x.aptName)
      return a.length >= 3 && (a.includes(target) || target.includes(a))
    })
    if (partial.length) return { level: 'partial', names: uniq(partial) }
  }
  return { level: 'none', names: [] }
}

/** 가장 긴 공통 부분 문자열 길이 */
function lcs(a, b) {
  let best = 0
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      let k = 0
      while (a[i + k] && a[i + k] === b[j + k]) k++
      if (k > best) best = k
    }
  return best
}

/** 단지명을 못 찾았을 때 검토용으로 보여 줄 비슷한 API 단지명 (최대 n개) */
export function similarNames(landmarkName, apiNames, n = 5) {
  const t = normName(landmarkName)
  return [...new Set(apiNames)]
    .map((x) => ({ x, s: lcs(t, normName(x)) }))
    .filter((v) => v.s >= 3)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((v) => v.x)
}

/**
 * 비교할 전용면적 범위
 * @returns {{ min: number, max: number, certain: boolean, label: string }}
 */
export function areaBand(landmark) {
  if (landmark.areaMin != null && landmark.areaMax != null) {
    return { min: landmark.areaMin, max: landmark.areaMax, certain: true, label: `전용 ${landmark.areaMin}~${landmark.areaMax}㎡ (직접 지정)` }
  }
  const p = landmark.pyeong
  if (p != null && p >= 33 && p <= 35) return { min: 83, max: 86, certain: true, label: `시트 ${p}평 → 전용 84㎡대(83~86㎡)` }
  if (p === 32) return { min: 74, max: 86, certain: false, label: '시트 32평 → 전용 74~86㎡ (평형 기준이 단지마다 달라 확인 필요)' }
  if (p != null && p >= 36 && p <= 37) return { min: 83, max: 100, certain: false, label: `시트 ${p}평 → 전용 83~100㎡ (확인 필요)` }
  if (p != null && p >= 30 && p <= 31) return { min: 59, max: 86, certain: false, label: `시트 ${p}평 → 전용 59~86㎡ (확인 필요)` }
  if (landmark.pyeongLabel) return { min: 83, max: 100, certain: false, label: `시트 ${landmark.pyeongLabel} → 전용 83~100㎡ (확인 필요)` }
  return { min: 59, max: 135, certain: false, label: '시트에 평형 정보 없음 → 전 면적 (확인 필요)' }
}

const byDateDesc = (a, b) => (b.contractDate ?? '').localeCompare(a.contractDate ?? '') || (b.floor ?? 0) - (a.floor ?? 0)

/** 최신 매매 (해제 거래 제외) */
export function pickLatestSale(items) {
  const valid = items.filter((s) => !s.cancelled && s.priceWon != null).sort(byDateDesc)
  return { latest: valid[0] ?? null, count: valid.length, cancelledCount: items.filter((s) => s.cancelled).length }
}

/**
 * 최신 전세 (월세 0원). 갱신 계약은 인상 상한이 있어 시세와 다를 수 있으므로 신규(또는 구분 없음)를 우선하고,
 * 기준 면적이 주어지면 ±1㎡ 안의 같은 면적을 우선한다.
 */
export function pickLatestJeonse(items, preferArea = null) {
  const jeonse = items.filter((r) => r.isJeonse && r.depositWon != null).sort(byDateDesc)
  const isNew = (r) => !r.contractType || !/갱신/.test(r.contractType)
  const sameArea = (r) => preferArea == null || Math.abs(r.area - preferArea) <= 1
  const pick =
    jeonse.find((r) => isNew(r) && sameArea(r)) ??
    jeonse.find((r) => sameArea(r)) ??
    jeonse.find((r) => isNew(r)) ??
    jeonse[0] ??
    null
  return { latest: pick, count: jeonse.length, renewalOnly: pick ? !isNew(pick) : false, sameArea: pick ? sameArea(pick) : false }
}

/** 전세가율(%) — 두 값이 있고 전용면적 차이가 1㎡ 이하일 때만 */
export function jeonseRatio(sale, jeonse) {
  if (!sale || !jeonse || sale.priceWon <= 0) return null
  if (Math.abs(sale.area - jeonse.area) > 1) return null
  return (jeonse.depositWon / sale.priceWon) * 100
}
