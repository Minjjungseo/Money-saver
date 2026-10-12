/**
 * 국평(전용 84㎡대) 비교 테스트. 거래 데이터는 테스트용 가짜 값이며 실제 시세가 아니다.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assignTradeIds, isKukpyeong, median, rankRows, recentMedian, splitBlocks } from './kukpyeong.mjs'
import { cacheOnlyFetcher, lookupKukpyeong } from './kukpyeong-batch.mjs'
import { saveMonth } from './ledger.mjs'
import { matchName } from './match.mjs'

const NOW = new Date(2026, 9, 12) // 2026-10-12
const dirs = []
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), 'kp-'))
  dirs.push(d)
  return d
}
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })))

const S = (aptName, date, price, extra = {}) => ({ kind: 'sale', aptName, dong: '테스트동', sggCd: '11650', area: 84.97, floor: 10, contractDate: date, priceWon: price, cancelled: false, dealingType: '중개거래', ...extra })
const R = (aptName, date, dep, extra = {}) => ({ kind: 'rent', aptName, dong: '테스트동', sggCd: '11650', area: 84.97, floor: 5, contractDate: date, depositWon: dep, monthlyWon: 0, isJeonse: true, contractType: '신규', ...extra })
/** {kind-ym: items}, 나머지 달은 다른 단지 거래 1건(지역 확인용) */
const fake = (table, lawd = '11650') => async (kind, l, ym) => ({ items: table[`${kind}-${ym}`] ?? [{ ...S('다른단지', `${ym.slice(0, 4)}-${ym.slice(4)}-01`, 1e9), sggCd: lawd, kind }] })
const lm = { name: '테스트단지', sheetText: '테스트단지(34")', sido: '서울', sigungu: '서초구', pyeong: 34, lawdCd: '11650' }

describe('국평 기준', () => {
  it('84.0 이상 85.0 미만만', () => {
    expect([83.99, 84, 84.97, 84.999, 85, 85.01].map(isKukpyeong)).toEqual([false, true, true, true, false, false])
  })
  it('중위가격과 표본 부족', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(3) // (2+3)/2 = 2.5 → 반올림
    const t = [S('a', '2026-09-01', 10e8), S('a', '2026-08-01', 12e8)]
    expect(recentMedian(t, (x) => x.priceWon, NOW)).toMatchObject({ medianWon: null, count: 2, status: expect.stringMatching(/표본 부족/) })
    const t3 = [...t, S('a', '2026-07-20', 11e8), S('a', '2026-06-01', 99e8)] // 6월은 기간 밖
    expect(recentMedian(t3, (x) => x.priceWon, NOW)).toMatchObject({ medianWon: 11e8, count: 3, status: '정상', period: '2026-07-12~2026-10-12' })
  })
})

describe('거래 식별 (잘못 합치지 않기)', () => {
  it('단지일련번호 우선, 같은 키가 한 응답에 두 번 나오면 둘 다 남긴다', () => {
    const a = S('x', '2026-09-01', 10e8, { aptSeq: '11650-123', jibun: '1' })
    const ids = assignTradeIds('sale', '11650', [a, { ...a }, { ...a, floor: 11 }])
    expect(ids.map((t) => t.tradeId.includes('seq:11650-123'))).toEqual([true, true, true])
    expect(new Set(ids.map((t) => t.tradeId)).size).toBe(3)
    expect(ids[1].tradeId.endsWith('#2')).toBe(true)
    expect(assignTradeIds('sale', '11650', [S('x', '2026-09-01', 1e9)])[0].idQuality).toMatch(/식별 약함/)
  })
  it('원장: 같은 달 재수신 시 변화 없으면 그대로, 해제 반영 등 변하면 이전본을 history 에 보관', () => {
    const dir = tmp()
    const m = { kind: 'sale', lawdCd: '11650', ym: '202609', items: [S('x', '2026-09-01', 1e9, { jibun: '1' })], fetchedAt: '2026-10-01T00:00:00Z' }
    expect(saveMonth(dir, m)).toBe('new')
    expect(saveMonth(dir, m)).toBe('same')
    expect(saveMonth(dir, { ...m, items: [{ ...m.items[0], cancelled: true, cancelDate: '26.10.05' }], fetchedAt: '2026-10-10T00:00:00Z' })).toBe('updated')
    expect(readdirSync(join(dir, 'history'))).toHaveLength(1)
  })
})

describe('블록', () => {
  it('설정이 없으면 API 단지명마다 블록 하나 (자동 합산 없음)', () => {
    expect(splitBlocks({}, ['송도더샵퍼스트파크(F13-1BL)', '송도더샵퍼스트파크(F14BL)']).map((b) => b.label)).toEqual(['F13-1BL', 'F14BL'])
    expect(splitBlocks({ blocks: [{ label: 'A', apiNames: ['x', 'y'] }] }, ['x', 'y'])).toEqual([{ label: 'A', names: ['x', 'y'], configured: true }])
  })
  it('송도처럼 블록별 행으로 나오고 그룹은 같다', async () => {
    const names = ['송도더샵퍼스트파크(F13-1BL)', '송도더샵퍼스트파크(F14BL)', '송도더샵퍼스트파크(F15BL)']
    const f = fake({
      'sale-202609': names.map((n, i) => S(n, '2026-09-1' + i, (9 + i) * 1e8, { area: 84.9 })),
      'rent-202609': names.map((n, i) => R(n, '2026-09-2' + i, 5e8, { area: 84.94 })),
    })
    const { rows } = await lookupKukpyeong({ ...lm, name: '송도더샵퍼스트파크', sheetText: '송도더샵퍼스트파크(35")' }, { getMonth: f, now: NOW })
    expect(rows.map((r) => r.블록.split(' ')[0])).toEqual(['F13-1BL', 'F14BL', 'F15BL'])
    expect(new Set(rows.map((r) => r.그룹))).toEqual(new Set(['송도더샵퍼스트파크(35")']))
    expect(rows.map((r) => r['매매 최신가(억)'])).toEqual([9, 10, 11])
  })
})

describe('단지 판정', () => {
  it('84㎡대가 없으면 국평 거래 없음 — 다른 면적으로 대체하지 않고 순위에서 제외', async () => {
    const f = fake({ 'sale-202609': [S('목동신시가지5', '2026-09-10', 20e8, { area: 95.03 }), S('목동신시가지5', '2026-09-11', 18e8, { area: 83.47 })] })
    const { rows, trades } = await lookupKukpyeong({ ...lm, name: '목동신시가지5' }, { getMonth: f, now: NOW })
    expect(rows[0].상태).toBe('국평 거래 없음')
    expect(rows[0]['매매 최신가(억)']).toBeNull()
    expect(rows[0].거래주의사유).toMatch(/83.47, 95.03/)
    expect(trades).toEqual([])
    expect(rankRows(rows)).toEqual([])
  })
  it('84㎡대 거래만 쓰고 실제 전용 타입을 기록, 3개월 표본이 적으면 중위가 없음', async () => {
    const f = fake({
      'sale-202609': [S('테스트단지', '2026-09-10', 10e8, { area: 84.95 }), S('테스트단지', '2026-09-12', 30e8, { area: 114.9 })],
      'sale-202608': [S('테스트단지', '2026-08-10', 9e8, { area: 84.99 })],
      'rent-202609': [R('테스트단지', '2026-09-18', 5e8), R('테스트단지', '2026-09-19', 4e8, { contractType: '갱신' })],
    })
    const { rows } = await lookupKukpyeong(lm, { getMonth: f, now: NOW })
    const r = rows[0]
    expect(r).toMatchObject({ 상태: '정상', 순위포함: 'Y', '매매 최신가(억)': 10, 매매전용면적: 84.95, '매매 3개월 건수': 2, '매매 3개월 중위(억)': null, '전세 최신가(억)': 5, '전세 3개월 갱신건수': 1 })
    expect(r['매매 3개월 표본']).toMatch(/표본 부족/)
    expect(r['국평타입(실제 전용)']).toBe('84.95㎡(1건), 84.97㎡(2건), 84.99㎡(1건)')
  })
  it('국평 기준이 맞아도 단지명 부분 일치·오래된 거래 규칙은 유지', async () => {
    const f = fake({ 'sale-202501': [S('테스트단지2차', '2025-01-10', 10e8)], 'rent-202609': [R('테스트단지2차', '2026-09-18', 5e8)] })
    const { rows } = await lookupKukpyeong({ ...lm, name: '테스트단지' }, { getMonth: f, now: NOW })
    expect(rows[0].상태).toBe('검증 필요')
    expect(rows[0].거래주의사유).toMatch(/개월 전/)
  })
  it('광안쌍용예가디오션 ↔ 광안동 쌍용예가디오션 은 exact, 다른 동이면 아님', () => {
    const lm2 = { name: '광안쌍용예가디오션' }
    expect(matchName(lm2, [{ aptName: '쌍용예가디오션', dong: '광안동' }]).level).toBe('exact')
    expect(matchName(lm2, [{ aptName: '쌍용예가디오션', dong: '민락동' }]).level).not.toBe('exact')
  })
  it('캐시 전용 실행: 캐시에 없는 달 때문에 거래 없음으로 단정하지 않는다', async () => {
    const dir = tmp()
    writeFileSync(join(dir, 'sale-11650-202610.json'), JSON.stringify({ items: [S('다른단지', '2026-10-01', 1e9)] }))
    const { rows } = await lookupKukpyeong(lm, { getMonth: cacheOnlyFetcher(dir), now: NOW })
    expect(rows[0].상태).toBe('캐시 부족')
  })
})
