import { describe, expect, it } from 'vitest'
import type { PriceRecord } from '@/store/schema'
import { changeFromPrevious, currentRatio, extremes, jeonseRatio, periodChange, ratioHistory, seriesOf } from './calc'

let n = 0
function rec(p: Partial<PriceRecord>): PriceRecord {
  n++
  return {
    id: `p${n}`, unitId: 'u1', kind: 'sale', amountWon: 1_000_000_000, dealDate: null, surveyDate: '2026-01-01',
    priceType: 'actual', sourceUrl: null, memo: null, entryId: null, legacy: false, isSample: false,
    createdAt: `2026-01-01T00:00:${String(n).padStart(2, '0')}Z`, updatedAt: '', ...p,
  }
}

describe('calc', () => {
  it('전세가율', () => {
    expect(jeonseRatio(1_000_000_000, 550_000_000)).toBeCloseTo(55)
    expect(jeonseRatio(null, 550_000_000)).toBeNull()
    expect(jeonseRatio(0, 1)).toBeNull()
  })

  it('호가와 실거래가는 다른 시계열이다', () => {
    const a = rec({ dealDate: '2026-01-10', amountWon: 1_000_000_000 })
    const b = rec({ dealDate: '2026-02-10', amountWon: 1_300_000_000, priceType: 'asking' })
    const c = rec({ dealDate: '2026-03-10', amountWon: 1_100_000_000 })
    const all = [a, b, c]
    expect(seriesOf(all, 'u1', 'sale', 'actual').map((r) => r.id)).toEqual([a.id, c.id])
    const ch = changeFromPrevious(all, c)!
    expect(ch.prev.id).toBe(a.id) // 호가 b를 건너뛴다
    expect(ch.diffWon).toBe(100_000_000)
    expect(ch.ratePct).toBeCloseTo(10)
    expect(changeFromPrevious(all, b)).toBeNull()
  })

  it('거래일이 없으면 조사일 기준으로 정렬한다', () => {
    const a = rec({ dealDate: null, surveyDate: '2026-05-01' })
    const b = rec({ dealDate: '2026-04-01', surveyDate: '2026-06-01' })
    expect(seriesOf([a, b], 'u1', 'sale', 'actual').map((r) => r.id)).toEqual([b.id, a.id])
  })

  it('현재 전세가율과 기준일 차이', () => {
    const s = rec({ dealDate: '2026-01-01', amountWon: 2_000_000_000 })
    const j = rec({ kind: 'jeonse', dealDate: '2026-05-01', amountWon: 1_000_000_000 })
    const r = currentRatio([s, j], 'u1')
    expect(r.ratio).toBeCloseTo(50)
    expect(r.gapDays).toBe(120)
  })

  it('전세가율 추이는 같은 입력 쌍만 사용한다', () => {
    const pts = ratioHistory(
      [
        rec({ entryId: 'e1', amountWon: 1_000_000_000, dealDate: '2026-01-05' }),
        rec({ entryId: 'e1', kind: 'jeonse', amountWon: 600_000_000, dealDate: '2026-01-20' }),
        rec({ entryId: 'e2', amountWon: 1_000_000_000 }), // 짝 없음
        rec({ surveyDate: '2026-03-01', amountWon: 1_000_000_000, priceType: 'asking' }),
        rec({ surveyDate: '2026-03-01', kind: 'jeonse', amountWon: 500_000_000, priceType: 'asking' }),
      ],
      'u1',
    )
    expect(pts).toHaveLength(2)
    expect(pts[0]).toMatchObject({ date: '2026-01-20', priceType: 'actual' })
    expect(pts[0].ratio).toBeCloseTo(60)
    expect(pts[1].ratio).toBeCloseTo(50)
  })

  it('기간 변화는 허용 오차 안의 과거 기록만 쓴다', () => {
    const series = [
      rec({ dealDate: '2025-10-01', amountWon: 1_000_000_000 }),
      rec({ dealDate: '2026-07-05', amountWon: 1_100_000_000 }),
      rec({ dealDate: '2026-10-01', amountWon: 1_210_000_000 }),
    ]
    const m3 = periodChange(series, 3)!
    expect(m3.diffWon).toBe(110_000_000)
    expect(m3.ratePct).toBeCloseTo(10)
    expect(periodChange(series, 12)!.diffWon).toBe(210_000_000)
    expect(periodChange(series, 6)).toBeNull() // 2026-04-01 근처 기록 없음
  })

  it('최고·최저', () => {
    const s = [rec({ amountWon: 5 }), rec({ amountWon: 9 }), rec({ amountWon: 1 })]
    const e = extremes(s)!
    expect(e.max.amountWon).toBe(9)
    expect(e.min.amountWon).toBe(1)
    expect(extremes([])).toBeNull()
  })
})

describe('headlineOf', () => {
  it('더 최근 호가가 있어도 실거래가를 대표 가격으로 쓴다', async () => {
    const { headlineOf } = await import('./calc')
    const a = rec({ unitId: 'h', dealDate: '2026-01-01', amountWon: 10 })
    const b = rec({ unitId: 'h', dealDate: '2026-05-01', amountWon: 12, priceType: 'asking' })
    expect(headlineOf([a, b], 'h', 'sale')!.id).toBe(a.id)
    expect(headlineOf([b], 'h', 'sale')!.id).toBe(b.id)
    expect(headlineOf([], 'h', 'sale')).toBeNull()
  })
})
