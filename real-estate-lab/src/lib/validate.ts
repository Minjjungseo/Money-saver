import { isValidISODate, todayISO } from './date'

export type Errors = Record<string, string>

export function checkDate(v: string, label: string, opts: { required?: boolean; today?: string } = {}): string | null {
  if (!v) return opts.required ? `${label}을(를) 입력하세요` : null
  if (!isValidISODate(v)) return `${label} 형식이 올바르지 않습니다`
  if (v > (opts.today ?? todayISO())) return `${label}이(가) 오늘 이후입니다`
  return null
}

export function checkUrl(v: string): string | null {
  if (!v.trim()) return null
  try {
    const u = new URL(v.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'http:// 또는 https:// 주소를 입력하세요'
    return null
  } catch {
    return '올바른 URL이 아닙니다 (https://… 형태)'
  }
}

export function checkOptionalInt(v: string, label: string, min: number, max: number): string | null {
  const s = v.trim().replace(/,/g, '')
  if (!s) return null
  if (!/^\d+$/.test(s)) return `${label}은(는) 숫자만 입력하세요`
  const n = Number(s)
  if (n < min || n > max) return `${label}은(는) ${min}~${max} 사이여야 합니다`
  return null
}

export function toOptionalInt(v: string): number | null {
  const s = v.trim().replace(/,/g, '')
  return s ? Number(s) : null
}

export function checkArea(v: string): string | null {
  const s = v.trim()
  if (!s) return '전용면적을 입력하세요'
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return '숫자로 입력하세요 (소수점 2자리까지, 예: 84.97)'
  const n = Number(s)
  if (n < 10 || n > 400) return '10~400㎡ 사이로 입력하세요'
  return null
}
