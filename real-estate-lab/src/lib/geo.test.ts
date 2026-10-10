import { describe, expect, it } from 'vitest'
import { convexHull, isInKorea, matchScore, parseCoord, priceStep } from './geo'

describe('geo', () => {
  it('좌표 검증', () => {
    expect(isInKorea(37.51, 127.1)).toBe(true)
    expect(isInKorea(33.5, 126.5)).toBe(true) // 제주
    expect(isInKorea(127.1, 37.51)).toBe(false) // 순서 바뀜
    expect(parseCoord('37.5', '127.0').ok).toBe(true)
    expect(parseCoord('', '127').ok).toBe(false)
    expect(parseCoord('127', '37.5').ok).toBe(false)
  })
  it('후보 일치도', () => {
    const c = { name: '잠실엘스', address: '서울 송파구 잠실동 19', roadAddress: '서울 송파구 올림픽로 99', category: '부동산 > 주거시설 > 아파트', lat: 37.5, lng: 127.08 }
    expect(matchScore('잠실엘스', ['서울', '송파구'], c)).toBe(3)
    expect(matchScore('잠실엘스', ['서울', '강남구'], c)).toBe(2)
    expect(matchScore('래미안', ['서울', '강남구'], { ...c, category: '음식점' })).toBe(0)
    expect(matchScore('새뜸10단지더샵힐스테이트', ['세종'], { ...c, name: '새뜸마을10단지 더샵힐스테이트', address: '세종특별자치시 소담동' })).toBe(2)
  })
  it('볼록 껍질', () => {
    const pts = [
      { lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }, { lat: 0, lng: 1 }, { lat: 0.5, lng: 0.5 },
    ]
    const h = convexHull(pts)
    expect(h).toHaveLength(4)
    expect(h).not.toContainEqual({ lat: 0.5, lng: 0.5 })
    expect(convexHull(pts.slice(0, 2))).toEqual([])
    expect(convexHull([{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }, { lat: 2, lng: 2 }])).toEqual([]) // 일직선
  })
  it('가격 색 구간', () => {
    expect(priceStep(null).label).toBe('가격 없음')
    expect(priceStep(450_000_000).label).toBe('5억 미만')
    expect(priceStep(1_000_000_000).label).toBe('10~15억')
    expect(priceStep(3_500_000_000).label).toBe('30억 이상')
  })
})
