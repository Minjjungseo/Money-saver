/**
 * 일괄 조회 로직 테스트. 여기의 거래 데이터는 테스트용으로 만든 가짜 값이며 실제 시세가 아니다.
 * 실제 응답 검증은 사용자 PC에서 npm run molit:batch 로 한다.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { appImportRows, lookupLandmark, runBatch, toCsv } from './batch.mjs'

const NOW = new Date(2026, 9, 10) // 2026-10-10
const lm = { name: '테스트단지', sheetText: '테스트단지(34")', sido: '서울', sigungu: '서초구', pyeong: 34, lawdCd: '11650' }
const sale = (ym, day, price, extra = {}) => ({ kind: 'sale', aptName: '테스트단지', dong: '반포동', sggCd: '11650', area: 84.99, floor: 10, contractDate: `${ym.slice(0, 4)}-${ym.slice(4)}-${day}`, priceWon: price, cancelled: false, dealingType: '중개거래', ...extra })
const rent = (ym, day, dep, extra = {}) => ({ kind: 'rent', aptName: '테스트단지', dong: '반포동', sggCd: '11650', area: 84.99, floor: 5, contractDate: `${ym.slice(0, 4)}-${ym.slice(4)}-${day}`, depositWon: dep, monthlyWon: 0, isJeonse: true, contractType: '신규', ...extra })

/** 테스트용 가짜 조회 함수: {kind-ym: items} */
function fakeFetcher(table) {
  const calls = []
  const fn = async (kind, lawd, ym) => {
    calls.push(`${kind}-${ym}`)
    return { items: table[`${kind}-${ym}`] ?? [{ ...sale(ym, '01', 1e9), aptName: '다른단지' }], fromCache: false, requests: 1 }
  }
  return Object.assign(fn, { calls })
}

describe('매매·전세 독립 조회', () => {
  it('매매는 6개월 안에서 찾고 멈추고, 전세는 따로 24개월까지 넓힌다', async () => {
    const f = fakeFetcher({ 'sale-202609': [sale('202609', '10', 5e9)], 'rent-202411': [rent('202411', '18', 1.6e9)] })
    const { results } = await runBatch({ landmarks: [lm], fetcher: f, now: NOW, gapMs: 0, log: () => {} })
    const row = results[0].row
    expect(f.calls.filter((c) => c.startsWith('sale'))).toHaveLength(6)
    expect(f.calls.filter((c) => c.startsWith('rent'))).toHaveLength(24)
    expect(row).toMatchObject({ '매매가(억)': 50, 매매계약일: '2026-09-10', 매매조회기간: '최근 6개월', '전세가(억)': 16, 전세조회기간: '최근 24개월', '전세가율(%)': 32 })
    expect(row.상태).toBe('검증 필요')
    expect(row.검증사유).toMatch(/계약일 차이/)
  })

  it('해제 거래 제외 · 정상 판정 · 앱 가져오기 CSV', async () => {
    const f = fakeFetcher({
      'sale-202610': [sale('202610', '02', 6e9, { cancelled: true, cancelDate: '26.10.05' })],
      'sale-202609': [sale('202609', '10', 5e9)],
      'rent-202609': [rent('202609', '18', 1.6e9), rent('202609', '25', 1.2e9, { contractType: '갱신' })],
    })
    const { results } = await runBatch({ landmarks: [lm], fetcher: f, now: NOW, gapMs: 0, log: () => {} })
    const { row, trades } = results[0]
    expect(row).toMatchObject({ 상태: '정상', '매매가(억)': 50, 해제제외건수: 1, '전세가(억)': 16, 전세계약구분: '신규' })
    expect(trades.find((t) => t.해제여부 === '해제')['금액(억)']).toBe(60)
    expect(trades.filter((t) => t.요약에사용 === 'Y')).toHaveLength(2)
    const app = appImportRows(results, [lm])
    expect(app.map((r) => [r.가격종류, r['금액(억)'], r.거래일, r.가격유형])).toEqual([
      ['매매', 50, '2026-09-10', '실거래가'],
      ['전세', 16, '2026-09-18', '실거래가'],
    ])
  })

  it('단지명을 못 찾으면 값 없이 비슷한 이름만 알려 준다', async () => {
    const f = fakeFetcher({ 'sale-202609': [{ ...sale('202609', '10', 5e9), aptName: '테스트단지2단지' }] })
    const { row } = await lookupLandmark({ ...lm, name: '테스트2차' }, { getMonth: f, now: NOW })
    expect(row.상태).toBe('단지명 확인 필요')
    expect(row['매매가(억)']).toBeNull()
  })

  it('응답 지역코드가 다르면 지역코드 확인 필요', async () => {
    const f = fakeFetcher({ 'sale-202609': [{ ...sale('202609', '10', 5e9), sggCd: '11680' }] })
    const { row } = await lookupLandmark(lm, { getMonth: f, now: NOW })
    expect(row.상태).toBe('지역코드 확인 필요')
  })

  it('지역코드 없는 단지는 호출하지 않는다', async () => {
    const f = fakeFetcher({})
    const { row } = await lookupLandmark({ ...lm, lawdCd: null }, { getMonth: f, now: NOW })
    expect(row.상태).toBe('지역코드 없음')
    expect(f.calls).toHaveLength(0)
  })

  it('한도 초과 같은 치명적 오류면 남은 단지는 중단으로 표시한다', async () => {
    const fetcher = async () => {
      throw Object.assign(new Error('LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR'), { fatal: true })
    }
    const { results, fatal } = await runBatch({ landmarks: [lm, { ...lm, name: 'B' }], fetcher, now: NOW, gapMs: 0, log: () => {} })
    expect(fatal).toMatch(/LIMITED/)
    expect(results.map((r) => r.row.상태)).toEqual(['오류', '중단'])
  })

  it('CSV는 BOM·따옴표 처리', () => {
    expect(toCsv([{ a: '쉼표,있음', b: null }])).toBe('﻿a,b\r\n"쉼표,있음",\r\n')
  })
})

describe('fetchMonth 재시도·캐시 (로컬 테스트 서버, 가짜 응답)', () => {
  let server
  let hits = 0
  let mode = 'flaky'
  let dir
  let molit
  const ok = '<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items><item><aptNm>테스트단지</aptNm><excluUseAr>84.99</excluUseAr><dealAmount>500,000</dealAmount><dealYear>2026</dealYear><dealMonth>9</dealMonth><dealDay>10</dealDay><floor>10</floor><sggCd>11650</sggCd></item></items><totalCount>1</totalCount></body></response>'
  beforeAll(async () => {
    server = createServer((req, res) => {
      hits++
      if (mode === 'flaky' && hits < 3) return res.writeHead(503).end('busy')
      if (mode === 'quota') return res.writeHead(200).end('<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg><returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>')
      res.writeHead(200).end(ok)
    })
    await new Promise((r) => server.listen(0, '127.0.0.1', r))
    process.env.MOLIT_API_BASE = `http://127.0.0.1:${server.address().port}`
    vi.resetModules()
    molit = await import('./molit.mjs')
    dir = mkdtempSync(join(tmpdir(), 'molit-test-'))
  })
  afterAll(() => {
    server.close()
    delete process.env.MOLIT_API_BASE
    rmSync(dir, { recursive: true, force: true })
  })

  it('503 두 번 뒤 성공: 재시도하고 캐시에 저장, 다음엔 호출 안 함', async () => {
    const r = await molit.fetchMonth('sale', '11650', '202609', 'k', { baseDelayMs: 1, cacheDir: dir })
    expect(hits).toBe(3)
    expect(r.requests).toBe(3)
    expect(r.items[0]).toMatchObject({ aptName: '테스트단지', priceWon: 5e9, contractDate: '2026-09-10' })
    const again = await molit.fetchMonth('sale', '11650', '202609', 'k', { baseDelayMs: 1, cacheDir: dir })
    expect(again.fromCache).toBe(true)
    expect(hits).toBe(3)
  })

  it('한도 초과는 재시도하지 않고 fatal', async () => {
    mode = 'quota'
    hits = 0
    await expect(molit.fetchMonth('sale', '11650', '202608', 'k', { baseDelayMs: 1, cacheDir: dir })).rejects.toMatchObject({ fatal: true })
    expect(hits).toBe(1)
  })

  it('캐시 기간: 이번 달 6시간 · 최근 3개월 하루 · 그 전 7일', () => {
    expect(molit.cacheMaxAgeMs('202610', NOW)).toBe(6 * 3600_000)
    expect(molit.cacheMaxAgeMs('202608', NOW)).toBe(24 * 3600_000)
    expect(molit.cacheMaxAgeMs('202601', NOW)).toBe(7 * 24 * 3600_000)
  })
})
