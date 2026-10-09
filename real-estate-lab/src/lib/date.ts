import type { ISODate } from '@/store/schema'

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 존재하는 날짜인지까지 확인한다 (2026-02-30 → false) */
export function isValidISODate(s: string): boolean {
  const m = ISO_RE.exec(s)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1970 || y > 2100) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

/** 로컬(한국) 기준 오늘 날짜 */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 시간대 영향 없이 날짜를 UTC 자정 타임스탬프로 */
export function isoToUTC(s: ISODate): number {
  const m = ISO_RE.exec(s)
  if (!m) throw new Error(`잘못된 날짜: ${s}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((isoToUTC(b) - isoToUTC(a)) / 86_400_000)
}

/** 월 단위 이동. 말일 보정: 2026-03-31 - 1개월 → 2026-02-28 */
export function addMonths(s: ISODate, months: number): ISODate {
  const m = ISO_RE.exec(s)
  if (!m) throw new Error(`잘못된 날짜: ${s}`)
  const y = Number(m[1])
  const mo = Number(m[2]) - 1 + months
  const d = Number(m[3])
  const targetY = y + Math.floor(mo / 12)
  const targetM = ((mo % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate()
  const dd = Math.min(d, lastDay)
  return `${targetY}-${String(targetM + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

export function formatDate(s: ISODate | null | undefined): string {
  if (!s) return '—'
  return s.replace(/-/g, '.')
}

export function formatShortDate(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getUTCFullYear()).slice(2)}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
