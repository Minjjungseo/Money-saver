import { describe, expect, it } from 'vitest'
import type { PriceRecord } from '@/store/schema'
import { emptyData } from '@/store/storage'
import { addApartment, addPriceEntry, findOrCreateUnit } from '@/store/ops'
import {
  ageBucket, areaBucket, bandOf, buildCompareChart, gapRow, median, pairPrices, periodStart, resolveItems, seriesStats, summarizeArea,
} from './compare'

let n = 0
function rec(p: Partial<PriceRecord>): PriceRecord {
  n++
  return {
    id: `r${n}`, unitId: 'u1', kind: 'sale', amountWon: 1_000_000_000, dealDate: null, surveyDate: '2026-01-01',
    priceType: 'actual', sourceUrl: null, memo: null, entryId: null, legacy: false, isSample: false,
    createdAt: `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}Z`, updatedAt: '', ...p,
  }
}

describe('기간', () => {
  it('오늘 기준 시작일', () => {
    expect(periodStart('1y', '2026-10-09')).toBe('2025-10-09')
    expect(periodStart('5y', '2026-10-09')).toBe('2021-10-09')
    expect(periodStart('all', '2026-10-09')).toBeNull()
  })
})

describe('비교 그래프', () => {
  const apt = { id: 'a1', name: 'A' } as never
  const unit = { id: 'u1', apartmentId: 'a1' } as never
  const prices = [
    rec({ dealDate: '2023-01-10', amountWon: 1_000_000_000 }),
    rec({ dealDate: '2023-03-10', amountWon: 1_100_000_000 }),
    rec({ dealDate: '2024-06-10', amountWon: 1_200_000_000 }), // 15개월 공백 → 선 끊김
    rec({ dealDate: '2024-06-20', amountWon: 1_300_000_000, priceType: 'asking' }),
  ]
  it('유형별로 따로, 긴 공백은 선 조각을 나눈다', () => {
    const c = buildCompareChart(prices, [{ apartment: apt, unit }], { kinds: ['sale'], types: ['actual', 'asking'], from: null })
    expect(c.series.map((s) => s.key)).toEqual(['s0_sale_actual', 's0_sale_asking'])
    expect(c.series[0].segments).toEqual(['s0_sale_actual_0', 's0_sale_actual_1'])
    // 보간 없음: 각 행에는 실제 기록이 있는 조각만 값이 있다
    for (const row of c.rows) {
      const keys = Object.keys(row).filter((k) => k !== 't')
      expect(keys.length).toBe(1)
    }
    expect(c.rows).toHaveLength(4)
  })
  it('기간 필터', () => {
    const c = buildCompareChart(prices, [{ apartment: apt, unit }], { kinds: ['sale'], types: ['actual'], from: '2024-01-01' })
    expect(c.series[0].records).toHaveLength(1)
  })
  it('최고·최저·최고점 대비', () => {
    const s = seriesStats([rec({ dealDate: '2023-01-01', amountWon: 10 }), rec({ dealDate: '2023-06-01', amountWon: 20 }), rec({ dealDate: '2024-01-01', amountWon: 15 })])!
    expect(s.max.amountWon).toBe(20)
    expect(s.min.amountWon).toBe(10)
    expect(s.latest.amountWon).toBe(15)
    expect(s.fromPeakPct).toBeCloseTo(-25)
    expect(seriesStats([])).toBeNull()
  })
})

describe('구간·필터', () => {
  it('가격 구간', () => {
    expect(bandOf(1_250_000_000, 5)).toMatchObject({ lo: 10, hi: 15 })
    expect(bandOf(1_500_000_000, 5)).toMatchObject({ lo: 15, hi: 20 })
    expect(bandOf(450_000_000, 3)).toMatchObject({ lo: 3, hi: 6 })
  })
  it('연식·면적', () => {
    expect(ageBucket(2022, 2026)).toBe('new')
    expect(ageBucket(2017, 2026)).toBe('mid')
    expect(ageBucket(null, 2026)).toBe('unknown')
    expect(areaBucket({ exclusiveArea: 84.97 } as never)).toBe('mid')
    expect(areaBucket({ exclusiveArea: null, pyeong: 34 } as never)).toBe('unknown')
  })
  it('중앙값', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(3) // (2+3)/2 반올림
    expect(median([])).toBeNull()
  })
})

describe('저평가 후보 가격 차이', () => {
  it('같은 유형끼리 맞추고, 안 되면 경고', () => {
    const p = [
      rec({ unitId: 't', priceType: 'asking', amountWon: 9, dealDate: '2026-01-01' }),
      rec({ unitId: 't', priceType: 'other', amountWon: 8, dealDate: '2024-01-01' }),
      rec({ unitId: 'o', priceType: 'other', amountWon: 10, dealDate: '2024-01-01' }),
    ]
    const pair = pairPrices(p, 't', 'o')
    expect(pair.sameType).toBe(true)
    expect(pair.target!.amountWon).toBe(8)
    const p2 = [rec({ unitId: 't', priceType: 'asking', amountWon: 9 }), rec({ unitId: 'o', priceType: 'actual', amountWon: 10 })]
    expect(pairPrices(p2, 't', 'o').sameType).toBe(false)
  })

  it('가격 차이와 주의사항을 계산하되 판정하지 않는다', () => {
    let d = emptyData()
    const mk = (name: string, by: number, area: number | null, pyeong: number | null, won: number, date: string) => {
      const a = addApartment(d, { regionId: '서울/마포구', name, address: null, builtYear: by, households: 1000, isLandmark: true, memo: null })
      const u = findOrCreateUnit(a.data, a.apartment.id, { area, pyeong, label: null })
      d = addPriceEntry(u.data, { unitId: u.unit.id, surveyDate: date, priceType: 'actual', sourceUrl: null, memo: null, sale: { amountWon: won, dealDate: date }, jeonse: null }).data
      return a.apartment.id
    }
    const t = mk('T', 2010, 84.9, null, 1_000_000_000, '2026-09-01')
    const o = mk('O', 2020, 59.9, null, 1_250_000_000, '2026-01-01')
    const [ti, oi] = resolveItems(d, [{ apartmentId: t, unitId: null }, { apartmentId: o, unitId: null }])
    const g = gapRow(d, ti, oi)
    expect(g.diffWon).toBe(250_000_000)
    expect(g.targetVsOtherPct).toBeCloseTo(-20)
    expect(g.builtYearDiff).toBe(-10)
    expect(g.warnings.some((w) => w.includes('전용면적이 다릅니다'))).toBe(true)
    expect(g.warnings.some((w) => w.includes('기준일'))).toBe(true)
    expect(g.warnings.join()).not.toContain('저평가')
    const s = summarizeArea(d, [t, o, 'missing'], o)
    expect(s.members).toHaveLength(2)
    expect(s.min!.apartment.id).toBe(t)
    expect(s.medianWon).toBe(1_125_000_000)
    expect(s.representative!.apartment.id).toBe(o)
  })
})
