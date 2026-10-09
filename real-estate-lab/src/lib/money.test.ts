import { describe, expect, it } from 'vitest'
import { formatDiff, formatEok, formatKoreanWon, parseEok, wonToEokInput } from './money'

describe('parseEok', () => {
  it('억 원 문자열을 원 단위 정수로 정확히 변환한다', () => {
    expect(parseEok('12.35')).toEqual({ ok: true, won: 1_235_000_000 })
    expect(parseEok('0.1')).toEqual({ ok: true, won: 10_000_000 })
    expect(parseEok('9.0001')).toEqual({ ok: true, won: 900_010_000 })
    expect(parseEok('1,000')).toEqual({ ok: true, won: 100_000_000_000 })
    // 부동소수점이면 1.1 * 1e8 = 110000000.00000001 이 되는 케이스
    expect(parseEok('1.1')).toEqual({ ok: true, won: 110_000_000 })
    expect(parseEok('  25 ')).toEqual({ ok: true, won: 2_500_000_000 })
  })
  it('잘못된 값은 거부한다', () => {
    for (const bad of ['', 'abc', '-1', '0', '0.0000', '1.23456', '1e3', '1001', '12.3.4']) {
      expect(parseEok(bad).ok, bad).toBe(false)
    }
  })
  it('wonToEokInput은 parseEok의 역함수다', () => {
    for (const s of ['12.35', '0.1', '9.0001', '25', '3.05']) {
      const r = parseEok(s)
      expect(r.ok && wonToEokInput(r.won)).toBe(s)
    }
  })
})

describe('표시 형식', () => {
  it('억/만 단위', () => {
    expect(formatKoreanWon(1_235_000_000)).toBe('12억 3,500만')
    expect(formatKoreanWon(2_500_000_000)).toBe('25억')
    expect(formatKoreanWon(35_000_000)).toBe('3,500만')
    expect(formatKoreanWon(null)).toBe('데이터 없음')
    expect(formatEok(1_235_000_000)).toBe('12.35억')
    expect(formatEok(2_500_000_000)).toBe('25억')
    expect(formatDiff(-120_000_000)).toBe('-1억 2,000만')
    expect(formatDiff(0)).toBe('변동 없음')
  })
})
