/**
 * 화면 테스트용 예시 데이터.
 * 실존 단지가 아닌 가상의 단지이며, 가격도 실제 시세가 아니다.
 * 모든 항목에 isSample = true 가 붙어 화면에 "예시 데이터"로 표시되고 한 번에 지울 수 있다.
 */
import { addMonths } from '@/lib/date'
import { WON_PER_MAN } from '@/lib/money'
import { addApartment, addPriceEntry, findOrCreateUnit } from '@/store/ops'
import type { AppData } from '@/store/schema'

interface SampleDef {
  regionId: string
  name: string
  area: number
  label: string
  builtYear: number
  households: number
  /** 시작 매매가(만 원), 분기별 변동(만 원) */
  sale: [number, number[]]
  jeonseRatio: number
}

const DEFS: SampleDef[] = [
  { regionId: '서울/강남구', name: '예시 A단지', area: 84.9, label: '84A', builtYear: 2009, households: 1800, sale: [240000, [3000, -2000, 5000, 6000, 4000, 8000, 7000, 5000]], jeonseRatio: 0.48 },
  { regionId: '경기/성남시', name: '예시 B단지', area: 84.5, label: '84B', builtYear: 2015, households: 1200, sale: [115000, [1000, -1500, 2000, 1500, 3000, 2500, 1000, 2000]], jeonseRatio: 0.58 },
  { regionId: '부산', name: '예시 C단지', area: 84.8, label: '84', builtYear: 2018, households: 2400, sale: [98000, [-1000, -2000, 500, 1000, -500, 1500, 1000, 500]], jeonseRatio: 0.62 },
]

export function addSampleData(d: AppData, today: string): AppData {
  let data = d
  for (const def of DEFS) {
    if (!data.regions.some((r) => r.id === def.regionId)) continue
    const a = addApartment(
      data,
      { regionId: def.regionId, name: def.name, address: '예시 주소 (실존하지 않음)', builtYear: def.builtYear, households: def.households, isLandmark: true, memo: '화면 테스트용 예시 데이터입니다.' },
      true,
    )
    data = a.data
    const u = findOrCreateUnit(data, a.apartment.id, def.area, def.label, true)
    data = u.data
    let man = def.sale[0]
    const steps = def.sale[1]
    steps.forEach((step, i) => {
      man += step
      const date = addMonths(today, -3 * (steps.length - i))
      const jeonseMan = Math.round((man * def.jeonseRatio) / 500) * 500
      data = addPriceEntry(data, {
        unitId: u.unit.id, surveyDate: date, priceType: 'actual', sourceUrl: null, memo: '예시 데이터',
        sale: { amountWon: man * WON_PER_MAN, dealDate: addMonths(date, 0) },
        jeonse: { amountWon: jeonseMan * WON_PER_MAN, dealDate: addMonths(date, -1) },
        isSample: true,
      }).data
    })
    // 호가는 별도 시계열로 1건
    data = addPriceEntry(data, {
      unitId: u.unit.id, surveyDate: today, priceType: 'asking', sourceUrl: null, memo: '예시 데이터 (호가)',
      sale: { amountWon: (man + 8000) * WON_PER_MAN, dealDate: null }, jeonse: null, isSample: true,
    }).data
  }
  return data
}
