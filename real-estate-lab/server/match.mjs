/**
 * 시트 랜드마크 ↔ 국토부 거래 매칭 규칙 (순수 함수, 테스트 대상)
 *
 * 단지명
 *  - 'exact'   : 공백·괄호·'아파트' 제거 + 영문 표기 통일(SK→에스케이 등) 후 같음 → 확실
 *  - 'alias'   : landmarks.json 에 사용자가 확인해 적은 apiNames 와 같음 → 확실
 *  - 'partial' : 한쪽 이름이 다른 쪽에 포함됨 → 검증 필요
 *  - 'none'    : 일치 없음
 * 전용면적
 *  - 시트는 평형(공급면적)만 있으므로, 평형으로 '있을 수 있는' 범위를 잡고
 *    실제 거래의 전용면적 타입 중 하나만 고른다(서로 다른 타입을 섞지 않음).
 *  - landmarks.json 에 areaMin/areaMax 를 직접 적으면 그 범위를 확실한 기준으로 쓴다.
 */

const LETTERS = [
  [/sk/g, '에스케이'],
  [/ipark/g, '아이파크'],
  [/dmc/g, '디엠씨'],
  [/the/g, '더'],
  [/xi/g, '자이'],
  [/s클래스/g, '에스클래스'],
  [/kcc/g, '케이씨씨'],
  [/lh/g, '엘에이치'],
]

/** 비교용 단지명 정규화 (괄호 안 내용 제거) */
export function normName(s) {
  return baseNorm(String(s ?? '').replace(/\(.*?\)/g, ''))
}

function baseNorm(s) {
  let t = String(s ?? '').toLowerCase()
  t = t.replace(/아파트|apt/g, '')
  t = t.replace(/[\s·.,\-_'"()[\]]/g, '')
  for (const [re, to] of LETTERS) t = t.replace(re, to)
  return t
}

/**
 * 한 이름의 비교 키들.
 *  - 괄호 내용 제거: "송도더샵퍼스트파크(F13-1블록)" → 송도더샵퍼스트파크
 *  - 괄호 내용 유지: "새뜸마을10단지(더샵힐스테이트)" → 새뜸마을10단지더샵힐스테이트
 *  - 각각 '마을' 제거: 새뜸10단지더샵힐스테이트 (세종·분당처럼 API에만 '마을'이 붙는 경우)
 */
export function nameKeys(s) {
  const keys = new Set()
  for (const k of [normName(s), baseNorm(s)]) {
    if (!k) continue
    keys.add(k)
    keys.add(k.replace(/마을/g, ''))
  }
  return [...keys].filter(Boolean)
}

const sameName = (a, b) => {
  const kb = nameKeys(b)
  return nameKeys(a).some((k) => kb.includes(k))
}
const containsName = (a, b) => {
  const ka = nameKeys(a).filter((k) => k.length >= 3)
  const kb = nameKeys(b).filter((k) => k.length >= 3)
  return ka.some((x) => kb.some((y) => x.includes(y) || y.includes(x)))
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
  // apiNames 를 적었으면 그 이름만 쓴다 (사용자가 확인한 이름이 가장 확실)
  if (landmark.apiNames?.length) {
    const hits = list.filter((x) => landmark.apiNames.some((a) => baseNorm(a) === baseNorm(x.aptName)))
    return hits.length ? { level: 'alias', names: uniq(hits) } : { level: 'none', names: [] }
  }
  const dongPrefix = /^(\S+동)\s+(.+)$/.exec(String(landmark.name).trim())
  const exact = list.filter((x) => sameName(landmark.name, x.aptName) || (dongPrefix && x.dong === dongPrefix[1] && sameName(dongPrefix[2], x.aptName)))
  if (exact.length) return { level: 'exact', names: uniq(exact) }
  const partial = list.filter((x) => containsName(landmark.name, x.aptName))
  if (partial.length) return { level: 'partial', names: uniq(partial) }
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
  const t = baseNorm(landmarkName)
  return [...new Set(apiNames)]
    .map((x) => ({ x, s: lcs(t, baseNorm(x)) }))
    .filter((v) => v.s >= 3)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((v) => v.x)
}

const PY = 3.3058 // 1평 = 3.3058㎡
/** 공급면적 대비 전용면적 비율로 볼 수 있는 범위 (신축 계단식 약 0.75, 1980~90년대 단지 약 0.80~0.85) */
export const EXCLUSIVE_RATIO = [0.7, 0.86]

/**
 * 시트 평형(공급면적 기준)으로 '있을 수 있는' 전용면적 범위.
 * 이 범위는 후보를 고르는 데만 쓰고, 실제 비교는 그 안의 전용면적 타입 하나(클러스터)로만 한다.
 * @returns {{ min: number, max: number, override: boolean, label: string }}
 */
export function typeWindow(landmark) {
  if (landmark.areaMin != null && landmark.areaMax != null) {
    return { min: landmark.areaMin, max: landmark.areaMax, override: true, label: `전용 ${landmark.areaMin}~${landmark.areaMax}㎡ (landmarks.json 직접 지정)` }
  }
  let lo = landmark.pyeong
  let hi = landmark.pyeong
  const range = /([\d.]+)\s*~\s*([\d.]+)/.exec(landmark.pyeongLabel ?? '')
  if (range) [lo, hi] = [Number(range[1]), Number(range[2])]
  if (lo == null) return { min: 0, max: 400, override: false, label: '시트에 평형 없음 → 전 면적 후보' }
  const r = (v) => Math.round(v * 10) / 10
  return {
    min: r(lo * PY * EXCLUSIVE_RATIO[0]),
    max: r(hi * PY * EXCLUSIVE_RATIO[1]),
    override: false,
    label: `시트 ${range ? landmark.pyeongLabel : `${lo}평`} → 전용 ${r(lo * PY * EXCLUSIVE_RATIO[0])}~${r(hi * PY * EXCLUSIVE_RATIO[1])}㎡ 후보`,
  }
}

/**
 * 거래들의 전용면적을 타입(클러스터)으로 묶는다. 서로 1㎡ 이내로 이어지는 면적은 같은 타입(예: 84.95/84.97/84.99 = 84㎡대).
 * @returns {{ min: number, max: number, count: number, areas: number[] }[]}  거래 많은 순
 */
export function areaClusters(items) {
  const areas = items.map((it) => it.area).filter((a) => a != null && Number.isFinite(a)).sort((a, b) => a - b)
  const out = []
  for (const a of areas) {
    const last = out[out.length - 1]
    if (last && a - last.max <= 1) {
      last.max = a
      last.count++
      if (!last.areas.includes(a)) last.areas.push(a)
    } else out.push({ min: a, max: a, count: 1, areas: [a] })
  }
  return out.sort((x, y) => y.count - x.count)
}

export const clusterLabel = (c) => `${c.min === c.max ? c.min : `${c.min}~${c.max}`}㎡(${c.count}건)`

/**
 * 비교할 전용면적 타입 하나를 고른다. 섞지 않는다.
 *  - landmarks.json 에 areaMin/areaMax 가 있으면 그 범위 (확실)
 *  - 평형 후보 범위 안에 타입이 하나뿐이면 그 타입 (확실)
 *  - 여러 개면 평형에 가장 가까운 타입을 고르되 '검증 필요' (어느 타입인지 사람이 확인해야 함)
 * @returns {{ band: {min:number,max:number}|null, certain: boolean, label: string, candidates: string }}
 */
export function chooseAreaType(landmark, items) {
  const w = typeWindow(landmark)
  const all = areaClusters(items)
  const candidates = all.map(clusterLabel).join(', ')
  if (w.override) return { band: { min: w.min, max: w.max }, certain: true, label: w.label, candidates }
  const inWin = all.filter((c) => c.max >= w.min && c.min <= w.max)
  if (inWin.length === 0) return { band: null, certain: false, label: `${w.label}에 해당하는 거래 타입 없음`, candidates }
  if (inWin.length === 1 && landmark.pyeong != null) {
    const c = inWin[0]
    return { band: { min: c.min, max: c.max }, certain: true, label: `${w.label} 중 유일한 타입 ${clusterLabel(c)}`, candidates }
  }
  // 여러 타입: 평형 공급면적 × 0.76(요즘 단지 전용률) 에 가장 가까운 타입 (추정이므로 확실하지 않음)
  const mid = landmark.pyeong != null ? landmark.pyeong * PY * 0.76 : null
  const pick = mid == null ? inWin[0] : [...inWin].sort((a, b) => Math.abs((a.min + a.max) / 2 - mid) - Math.abs((b.min + b.max) / 2 - mid))[0]
  return {
    band: { min: pick.min, max: pick.max },
    certain: false,
    label: `${w.label}에 타입 ${inWin.length}개(${inWin.map(clusterLabel).join(', ')}) → ${clusterLabel(pick)} 임시 선택`,
    candidates,
  }
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
