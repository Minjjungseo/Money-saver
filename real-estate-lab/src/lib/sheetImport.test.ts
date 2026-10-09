import { describe, expect, it } from 'vitest'
import { emptyData } from '@/store/storage'
import { importTrackingSheet, parseAptName, type SheetRows } from './sheetImport'
import { seriesOf } from './calc'

const D1 = new Date(Date.UTC(2023, 6, 20))
const D2 = new Date(Date.UTC(2023, 7, 15))

// 실제 시트와 같은 모양의 축소판
const tracking: SheetRows = [
  ['https://cafe.naver.com/x', null, null, '매매', '전세', '전세율', '매매', '전세', '전세율'],
  [null, null, null, D1, null, null, D2, null, null],
  ['서울'],
  [1, '강남구(1군)', '래미안라클래시(34")', 34.5, 16.4, 0.47, 34.5, 16, 0.46],
  [2, '성동구(2군)', '서울숲힐스테이트(35")', 24, null, 0, 24, 0, 0],
  [null, null, '추가단지(36")', null, null, '#DIV/0!', 17, 8.5, 0.5],
  ['경기'],
  [1, '성남시 분당구', '백현마을2단지(32")', 18.5, 8.6, 0.46, null, null, null],
  [2, '용인 처인구', '킨텍스원시티M3(35~37")', 5.95, 3.6, 0.6, null, null, null],
  ['광역시'],
  ['인천'],
  [1, '서구', '한양수자인레이크블루(34")', 7.5, 4, 0.5, null, null, null],
  ['창원'],
  [1, '성산구', '용지더샵레이크파크(34")', 9.3, 6, 0.6, null, null, null],
]
const landmark: SheetRows = [
  [null, null, null, null, '규모', '지역', '지역', '랜드마크 단지명', '세대수', '연식', '매매가'],
  [null, null, null, null, '수도권', '서울', '강남구(1군)', '래미안라클래시(34")', 679, 2021, 32.8],
]

describe('기존 시트 가져오기', () => {
  it('평형 이름 분리', () => {
    expect(parseAptName('래미안라클래시(34")')).toEqual({ name: '래미안라클래시', pyeong: 34, label: null })
    expect(parseAptName('킨텍스원시티M3(35~37")')).toEqual({ name: '킨텍스원시티M3', pyeong: null, label: '35~37평' })
    expect(parseAptName('두산위브지웰시티2차(주복)(34")')).toEqual({ name: '두산위브지웰시티2차(주복)', pyeong: 34, label: null })
    expect(parseAptName('동두천센트레빌')).toEqual({ name: '동두천센트레빌', pyeong: null, label: null })
  })

  it('지역·단지·가격을 변환한다', () => {
    const r = importTrackingSheet(emptyData(), tracking, landmark)
    expect(r.dates).toEqual(['2023-07-20', '2023-08-15'])
    expect(r.stats.apartments).toBe(7)
    const byName = (n: string) => r.data.apartments.find((a) => a.name === n)!
    expect(byName('래미안라클래시')).toMatchObject({ regionId: '서울/강남구', builtYear: 2021, households: 679, isLandmark: true })
    expect(byName('래미안라클래시').memo).toContain('급지: 1군')
    expect(byName('추가단지')).toMatchObject({ regionId: '서울/성동구', isLandmark: false })
    expect(byName('백현마을2단지').regionId).toBe('경기/성남시/분당구')
    expect(byName('킨텍스원시티M3').regionId).toBe('경기/용인시/처인구')
    expect(byName('한양수자인레이크블루').regionId).toBe('인천/서해구')
    expect(byName('용지더샵레이크파크').regionId).toBe('경남/창원시/성산구')

    const unit = r.data.units.find((u) => u.apartmentId === byName('래미안라클래시').id)!
    expect(unit).toMatchObject({ exclusiveArea: null, pyeong: 34 })
    const sale = seriesOf(r.data.prices, unit.id, 'sale', 'other')
    expect(sale.map((p) => [p.surveyDate, p.amountWon, p.legacy, p.dealDate])).toEqual([
      ['2023-07-20', 3_450_000_000, true, null],
      ['2023-08-15', 3_450_000_000, true, null],
    ])
    // 전세 비어 있음/0 → 저장하지 않음
    const forest = r.data.units.find((u) => u.apartmentId === byName('서울숲힐스테이트').id)!
    expect(r.data.prices.filter((p) => p.unitId === forest.id && p.kind === 'jeonse')).toHaveLength(0)
    expect(r.data.prices.filter((p) => p.unitId === forest.id && p.kind === 'sale')).toHaveLength(2)
    // 5.95억 소수 처리
    expect(r.data.prices.some((p) => p.amountWon === 595_000_000)).toBe(true)
    expect(r.rows.find((x) => x.name === '추가단지(36")')!.note).toContain('바로 위 행')
  })

  it('다시 가져오면 중복이 생기지 않고, 전용면적을 채운 뒤에도 같은 면적을 쓴다', () => {
    const first = importTrackingSheet(emptyData(), tracking, landmark)
    const d = { ...first.data, units: first.data.units.map((u) => ({ ...u, exclusiveArea: 84.97 })) }
    const again = importTrackingSheet(d, tracking, landmark)
    expect(again.stats).toMatchObject({ apartments: 0, units: 0, prices: 0 })
    expect(again.stats.duplicates).toBeGreaterThan(0)
  })

  it('날짜 행이 없으면 오류', () => {
    expect(() => importTrackingSheet(emptyData(), [['서울'], [1, '강남구', 'x', 1]])).toThrow()
  })
})
