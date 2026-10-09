import { describe, expect, it } from 'vitest'
import { addApartment, addPriceEntry, findOrCreateUnit, removeSample } from '@/store/ops'
import { emptyData } from '@/store/storage'
import { addSampleData } from '@/data/sample'
import { exportJSON, exportPricesCSV, importPricesCSV, mergeData, parseBackupJSON } from './backup'
import { parseCSV, toCSV } from './csv'

const TODAY = '2026-10-09'

describe('csv', () => {
  it('따옴표·쉼표·줄바꿈을 보존한다', () => {
    const rows = [['a,b', 'he said "hi"', 'line1\nline2'], ['', 'x', '']]
    expect(parseCSV(toCSV(rows))).toEqual(rows.slice(0, 1).concat([['', 'x', '']]))
  })
})

describe('CSV 가져오기', () => {
  const csv = [
    '시도,시군구,단지명,전용면적,면적타입,가격종류,금액(억),거래일,조사일,가격유형,출처URL,메모',
    '서울특별시,강남구,테스트단지,84.97,84A,매매,25.5,2026.9.15,2026-10-01,실거래가,https://x.y,',
    '서울,강남구,테스트 단지,84.97,84a,전세,12,2026-09-20,2026-10-01,실거래가,,',
    '서울,강남구,테스트단지,84.97,84A,매매,25.5,2026-09-15,2026-10-01,실거래가,,중복',
    '서울,없는구,새단지,59,,매매,10,,2026-10-01,호가,,',
    '서울,강남구,테스트단지,84.97,,매매,abc,,2026-10-01,,,',
    '화성,,x,59,,매매,1,,2026-10-01,,,',
    '서울,강남구,테스트단지,84.97,,매매,1,,2026-12-01,,,',
  ].join('\n')

  it('지역·단지·면적을 이름으로 찾고 중복과 오류를 걸러낸다', () => {
    const { data, stats } = importPricesCSV(emptyData(), csv, TODAY)
    expect(stats.added.prices).toBe(3)
    expect(stats.duplicates).toBe(1)
    expect(stats.errors.map((e) => e.line)).toEqual([6, 7, 8])
    expect(stats.added.apartments).toBe(2) // 공백 차이는 같은 단지
    expect(stats.added.units).toBe(2) // 84A == 84a
    expect(stats.added.regions).toBe(1) // 없는구
    const sale = data.prices.find((p) => p.kind === 'sale' && p.amountWon === 2_550_000_000)!
    expect(sale.dealDate).toBe('2026-09-15')
    // 같은 파일을 다시 가져오면 전부 중복
    const again = importPricesCSV(data, csv, TODAY)
    expect(again.stats.added.prices).toBe(0)
    expect(again.stats.duplicates).toBe(4)
  })

  it('내보낸 CSV를 다시 가져오면 같은 내용이 된다', () => {
    const first = importPricesCSV(emptyData(), csv, TODAY).data
    const round = importPricesCSV(emptyData(), exportPricesCSV(first), TODAY)
    expect(round.stats.errors).toEqual([])
    expect(round.data.prices.map((p) => [p.kind, p.amountWon, p.dealDate, p.priceType]).sort()).toEqual(
      first.prices.map((p) => [p.kind, p.amountWon, p.dealDate, p.priceType]).sort(),
    )
  })

  it('필수 열이 없으면 아무것도 바꾸지 않는다', () => {
    const cur = emptyData()
    const r = importPricesCSV(cur, '단지명,금액\nx,1', TODAY)
    expect(r.data).toBe(cur)
    expect(r.stats.errors.length).toBeGreaterThan(0)
  })
})

describe('JSON 백업', () => {
  it('내보내기 → 가져오기 왕복', () => {
    const d = addSampleData(emptyData(), TODAY)
    const back = parseBackupJSON(exportJSON(d))
    expect(back.prices).toEqual(d.prices)
    expect(back.apartments).toEqual(d.apartments)
  })
  it('병합 시 같은 기록은 중복으로 건너뛴다', () => {
    const d = addSampleData(emptyData(), TODAY)
    const { stats } = mergeData(d, d)
    expect(stats.added.prices).toBe(0)
    expect(stats.duplicates).toBe(d.prices.length)
  })
  it('형식이 틀린 파일은 거부한다', () => {
    expect(() => parseBackupJSON('{}')).toThrow()
    expect(() => parseBackupJSON('not json')).toThrow()
    expect(() => parseBackupJSON(JSON.stringify({ apartments: [], prices: [{ id: 'x', amountWon: -1 }] }))).toThrow()
  })
})

describe('예시 데이터', () => {
  it('예시만 지우고 사용자 기록은 남긴다', () => {
    let d = addSampleData(emptyData(), TODAY)
    expect(d.prices.every((p) => p.isSample)).toBe(true)
    const sampleUnit = d.units[0]
    d = addPriceEntry(d, {
      unitId: sampleUnit.id, surveyDate: TODAY, priceType: 'actual', sourceUrl: null, memo: null,
      sale: { amountWon: 3_000_000_000, dealDate: TODAY }, jeonse: null,
    }).data
    const a = addApartment(d, { regionId: '서울/마포구', name: '내단지', address: null, builtYear: null, households: null, isLandmark: true, memo: null })
    d = findOrCreateUnit(a.data, a.apartment.id, 59, null).data
    const cleaned = removeSample(d)
    expect(cleaned.prices).toHaveLength(1)
    expect(cleaned.units.map((u) => u.id)).toContain(sampleUnit.id)
    expect(cleaned.apartments.map((x) => x.name).sort()).toEqual(['내단지', '예시 A단지'])
  })
})
