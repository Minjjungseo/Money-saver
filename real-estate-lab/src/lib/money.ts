export const WON_PER_EOK = 100_000_000
export const WON_PER_MAN = 10_000
/** 입력 허용 상한: 1,000억 */
export const MAX_EOK = 1000

export type ParseResult = { ok: true; won: number } | { ok: false; error: string }

/**
 * "12.35" (억 원) → 1_235_000_000 (원)
 * 부동소수점 곱셈 오차를 피하려고 문자열을 정수부·소수부로 나눠 계산한다.
 * 소수점 4자리(=만원)까지만 허용한다.
 */
export function parseEok(input: string): ParseResult {
  const s = input.trim().replace(/,/g, '')
  if (s === '') return { ok: false, error: '금액을 입력하세요' }
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s)
  if (!m) return { ok: false, error: '숫자만 입력하세요 (예: 12.35)' }
  const [, intPart, fracRaw = ''] = m
  if (fracRaw.length > 4) return { ok: false, error: '소수점 4자리(만 원)까지만 입력할 수 있어요' }
  const frac = fracRaw.padEnd(4, '0')
  const won = Number(intPart) * WON_PER_EOK + Number(frac) * WON_PER_MAN
  if (!Number.isSafeInteger(won)) return { ok: false, error: '금액이 너무 큽니다' }
  if (won <= 0) return { ok: false, error: '0보다 큰 금액을 입력하세요' }
  if (won > MAX_EOK * WON_PER_EOK) return { ok: false, error: `${MAX_EOK}억 이하로 입력하세요` }
  return { ok: true, won }
}

/** 원 → 입력칸에 다시 채울 억 원 문자열 (1_235_000_000 → "12.35") */
export function wonToEokInput(won: number): string {
  const eok = Math.floor(won / WON_PER_EOK)
  const man = Math.round((won % WON_PER_EOK) / WON_PER_MAN)
  if (man === 0) return String(eok)
  return `${eok}.${String(man).padStart(4, '0').replace(/0+$/, '')}`
}

/** 1_235_000_000 → "12.35억" (표·차트용 짧은 표기) */
export function formatEok(won: number | null | undefined, digits = 2): string {
  if (won == null) return '데이터 없음'
  const v = won / WON_PER_EOK
  return `${trimZeros(v.toFixed(digits))}억`
}

/** 1_235_000_000 → "12억 3,500만" (상세 표기) */
export function formatKoreanWon(won: number | null | undefined): string {
  if (won == null) return '데이터 없음'
  const sign = won < 0 ? '-' : ''
  const abs = Math.abs(won)
  const eok = Math.floor(abs / WON_PER_EOK)
  const man = Math.round((abs % WON_PER_EOK) / WON_PER_MAN)
  if (eok === 0) return `${sign}${man.toLocaleString('ko-KR')}만`
  if (man === 0) return `${sign}${eok}억`
  return `${sign}${eok}억 ${man.toLocaleString('ko-KR')}만`
}

/** 변동액: +3,500만 / -1억 2,000만 */
export function formatDiff(won: number | null): string {
  if (won == null) return '—'
  if (won === 0) return '변동 없음'
  return `${won > 0 ? '+' : ''}${formatKoreanWon(won)}`
}

export function formatPct(v: number | null, digits = 1, signed = true): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = v.toFixed(digits)
  return `${signed && v > 0 ? '+' : ''}${s}%`
}

function trimZeros(s: string): string {
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s
}
