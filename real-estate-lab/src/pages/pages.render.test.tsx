// @vitest-environment jsdom
/**
 * 페이지 렌더링 테스트: 모든 메뉴·상세 화면을 여러 데이터 상태에서 실제로 그려 본다.
 * - 화면이 오류 안내(role=alert, ErrorBoundary)로 바뀌지 않는지
 * - React 오류 로그가 없는지
 * - 사이드바 메뉴를 실제로 클릭해 이동해도 앱이 멈추지 않는지 (scrollTo가 Promise를 반환하는 최신 브라우저 포함)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { AppData } from '@/store/schema'

const TODAY = '2026-10-10'

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  ;(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
  localStorage.clear()
  vi.resetModules()
})
afterEach(() => cleanup())

/** 데이터 상태별로 localStorage를 채운 뒤 앱 모듈을 새로 불러온다 */
async function boot(data: AppData | null) {
  if (data) localStorage.setItem('mrel:data:v1', JSON.stringify(data))
  const { default: App } = await import('@/App')
  return App
}

async function sampleData() {
  const { emptyData } = await import('@/store/storage')
  const { addSampleData } = await import('@/data/sample')
  return addSampleData(emptyData(), TODAY)
}

/** 시트에서 가져온 것과 같은 모양(평형만 있는 면적, 과거자료) + 생활권·후보·위치·비교 목록까지 채운 데이터 */
async function richData() {
  const { emptyData } = await import('@/store/storage')
  const ops = await import('@/store/ops')
  let d = emptyData()
  const mk = (name: string, regionId: string, pyeong: number | null, area: number | null, won: number) => {
    const a = ops.addApartment(d, { regionId, name, address: null, builtYear: 2010, households: 1000, isLandmark: true, memo: null })
    const u = ops.findOrCreateUnit(a.data, a.apartment.id, { area, pyeong, label: null })
    d = ops.addPriceEntry(u.data, {
      unitId: u.unit.id, surveyDate: '2024-03-04', priceType: 'other', sourceUrl: null, memo: null, legacy: true,
      sale: { amountWon: won, dealDate: null }, jeonse: { amountWon: Math.round(won / 2), dealDate: null },
    }).data
    d = ops.addPriceEntry(d, {
      unitId: u.unit.id, surveyDate: '2023-07-20', priceType: 'other', sourceUrl: null, memo: null, legacy: true,
      sale: { amountWon: won - 100_000_000, dealDate: null }, jeonse: null,
    }).data
    return a.apartment.id
  }
  const a1 = mk('테스트엘스', '서울/송파구', 33, null, 2_300_000_000)
  const a2 = mk('테스트자이', '서울/마포구', 34, null, 1_940_000_000)
  const a3 = mk('면적없음단지', '부산', null, null, 900_000_000)
  const a4 = ops.addApartment(d, { regionId: '경기', name: '가격없음단지', address: null, builtYear: null, households: null, isLandmark: false, memo: null })
  d = a4.data
  d = ops.addLivingArea(d, { name: '테스트 생활권', description: null, apartmentIds: [a1, a2, a3, a4.apartment.id, 'deleted-id'], representativeId: a1 }).data
  d = ops.addCandidate(d, {
    target: { apartmentId: a2, unitId: null }, comparisons: [{ apartmentId: a1, unitId: null }, { apartmentId: a4.apartment.id, unitId: null }],
    hypothesis: '가설', evidenceToCheck: '근거1\n근거2', locationDiff: null, ageDiff: null, areaDiff: null, volumeDiff: null, status: 'studying', conclusion: null,
  }).data
  d = ops.setApartmentLocation(d, a1, { lat: 37.51, lng: 127.08, source: 'manual', matchedName: null, matchedAddress: null, setAt: TODAY })
  d = ops.addToCompare(d, { apartmentId: a1, unitId: null })
  d = ops.addToCompare(d, { apartmentId: a4.apartment.id, unitId: null })
  return { d, ids: { a1, a2, a3, a4: a4.apartment.id, area: d.livingAreas[0].id } }
}

const MENU_PAGES: [string, RegExp][] = [
  ['/', /전국 시장 현황/],
  ['/regions', /시·도 → 시·군·구/],
  ['/apartments', /랜드마크 아파트/],
  ['/compare', /랜드마크 가격 비교/],
  ['/map', /지도/],
  ['/areas', /행정구역과 별개로/],
  ['/candidates', /저평가 후보 탐색 노트/],
  ['/input', /시세 직접 입력/],
  ['/backup', /백업 · 복원/],
]

async function renderAt(App: React.ComponentType, path: string) {
  const errors: unknown[] = []
  const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a))
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
  spy.mockRestore()
  return errors
}

function expectHealthy(errors: unknown[], heading: RegExp) {
  expect(screen.queryByRole('alert'), '오류 안내 화면이 뜨면 안 됨').toBeNull()
  expect(screen.getAllByText(heading).length).toBeGreaterThan(0)
  const reactErrors = errors.filter((e) => /Error|error|Warning/.test(String((e as unknown[])[0])))
  expect(reactErrors, String(reactErrors[0])).toEqual([])
}

describe.each([
  ['데이터 없음(초기 상태)', 'empty'],
  ['예시 데이터', 'sample'],
  ['시트 가져온 형태 + 생활권·후보·위치', 'rich'],
] as const)('%s', (_label, kind) => {
  it.each(MENU_PAGES)('%s 렌더링', async (path, heading) => {
    const data = kind === 'empty' ? null : kind === 'sample' ? await sampleData() : (await richData()).d
    const App = await boot(data)
    const errors = await renderAt(App, path)
    expectHealthy(errors, heading)
  })
})

describe('상세 화면', () => {
  it('단지·지역·생활권 상세와 더보기', async () => {
    const { d, ids } = await richData()
    for (const [path, heading] of [
      [`/apartments/${ids.a1}`, /테스트엘스/],
      [`/apartments/${ids.a3}`, /면적없음단지/],
      [`/apartments/${ids.a4}`, /가격없음단지/],
      [`/regions/${encodeURIComponent('서울/송파구')}`, /서울 송파구/],
      [`/regions/${encodeURIComponent('제주')}`, /제주/],
      [`/areas/${ids.area}`, /테스트 생활권/],
      ['/more', /메뉴/],
    ] as [string, RegExp][]) {
      vi.resetModules()
      localStorage.clear()
      const App = await boot(d)
      const errors = await renderAt(App, path)
      expectHealthy(errors, heading)
      cleanup()
    }
  })

  it('없는 단지·생활권 주소는 목록으로 돌아간다', async () => {
    const App = await boot(null)
    const errors = await renderAt(App, '/apartments/없는id')
    expectHealthy(errors, /랜드마크 아파트/)
  })

  it('예전 형식(1단계) 저장 데이터도 그대로 열린다', async () => {
    const d = (await sampleData()) as unknown as Record<string, unknown>
    delete d.livingAreas
    delete d.candidates
    ;(d.settings as Record<string, unknown>).compare = undefined
    for (const a of d.apartments as Record<string, unknown>[]) {
      delete a.location
      delete a.transitMemo
    }
    const App = await boot(d as unknown as AppData)
    for (const [path, heading] of MENU_PAGES) {
      const errors = await renderAt(App, path)
      expectHealthy(errors, heading)
      cleanup()
    }
  })
})

describe('사이드바 메뉴 실제 클릭 이동', () => {
  for (const promiseScroll of [false, true]) {
    it(`홈 → 8개 메뉴 차례로 클릭 (scrollTo가 Promise 반환: ${promiseScroll})`, async () => {
      if (promiseScroll) window.scrollTo = vi.fn(() => Promise.resolve()) as unknown as typeof window.scrollTo
      const App = await boot((await richData()).d)
      const errors = await renderAt(App, '/')
      expectHealthy(errors, /전국 시장 현황/)
      const sidebar = screen.getAllByRole('navigation')[0]
      const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a))
      for (const [label, heading] of [
        ['지역', /시·도 → 시·군·구/],
        ['단지', /랜드마크 아파트/],
        ['가격 비교', /랜드마크 가격 비교/],
        ['지도', /카카오맵/],
        ['생활권', /행정구역과 별개로/],
        ['후보 노트', /저평가 후보 탐색 노트/],
        ['시세 입력', /시세 직접 입력/],
        ['백업', /백업 · 복원/],
        ['홈', /전국 시장 현황/],
      ] as [string, RegExp][]) {
        fireEvent.click(within(sidebar).getByRole('link', { name: label }))
        expect(screen.queryByRole('alert'), `${label} 클릭 후 오류 화면`).toBeNull()
        expect(screen.getAllByText(heading).length, `${label} 화면 내용`).toBeGreaterThan(0)
      }
      spy.mockRestore()
      expect(errors).toEqual([])
    })
  }
})

describe('ErrorBoundary', () => {
  it('한 화면의 오류는 그 화면만 대체하고 메뉴는 남는다', async () => {
    const { ErrorBoundary } = await import('@/components/ErrorBoundary')
    const Boom = () => {
      throw new Error('테스트용 오류')
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <div>
        <nav>메뉴</nav>
        <ErrorBoundary scope="page">
          <Boom />
        </ErrorBoundary>
      </div>,
    )
    spy.mockRestore()
    expect(screen.getByRole('alert').textContent).toContain('테스트용 오류')
    expect(screen.getByText('메뉴')).toBeTruthy()
    expect(screen.getByText(/입력한 데이터는 그대로 저장되어 있습니다/)).toBeTruthy()
  })
})
