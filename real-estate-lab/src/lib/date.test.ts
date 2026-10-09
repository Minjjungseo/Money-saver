import { describe, expect, it } from 'vitest'
import { addMonths, daysBetween, isValidISODate, todayISO } from './date'

describe('date', () => {
  it('존재하지 않는 날짜를 거부한다', () => {
    expect(isValidISODate('2026-02-28')).toBe(true)
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('2026-13-01')).toBe(false)
    expect(isValidISODate('2026-1-01')).toBe(false)
  })
  it('월 이동 시 말일을 보정한다', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2026-01-15', -3)).toBe('2025-10-15')
    expect(addMonths('2025-11-30', 3)).toBe('2026-02-28')
    expect(addMonths('2026-10-09', -12)).toBe('2025-10-09')
  })
  it('일수 차이는 시간대 영향이 없다', () => {
    expect(daysBetween('2026-03-01', '2026-03-31')).toBe(30)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1) // 미국 서머타임 시작일
  })
  it('todayISO는 로컬 날짜', () => {
    expect(todayISO(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09')
  })
})
