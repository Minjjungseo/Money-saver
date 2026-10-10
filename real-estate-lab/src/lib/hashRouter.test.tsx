// @vitest-environment jsdom
/**
 * 메뉴 클릭 → 화면 전환 테스트.
 * 핵심: 클릭 "직후"(기다리지 않고) 주소와 함께 실제 페이지 제목·내용이 바뀌었는지 확인한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import type { ComponentType, ReactNode } from 'react'

class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  ;(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO
  // 최신 크롬처럼 scrollTo가 Promise를 반환하는 환경으로 테스트
  window.scrollTo = vi.fn(() => Promise.resolve()) as unknown as typeof window.scrollTo
  localStorage.clear()
  window.history.replaceState(null, '', '#/')
  vi.resetModules()
})
afterEach(() => cleanup())

const h1 = () => document.querySelector('main h1')?.textContent ?? '(없음)'
const sidebar = () => screen.getAllByRole('navigation')[0]
const clickMenu = (label: string) => fireEvent.click(within(sidebar()).getByRole('link', { name: label }))

async function loadApp() {
  const { default: App } = await import('@/App')
  const { AppHashRouter } = await import('./hashRouter')
  return { App, AppHashRouter }
}

/**
 * 실제 사용자 증상을 결정적으로 재현하는 가짜 window:
 * - history.pushState가 SecurityError로 막혀 있고
 * - location.assign/hash 변경이 즉시 반영되지 않는다(나중에 반영되며 hashchange만 발생)
 */
function adversarialWindow() {
  let hash = '#/'
  let pending: string | null = null
  const listeners: Record<string, Set<EventListener>> = {}
  const fire = (type: string) => listeners[type]?.forEach((l) => l(new Event(type)))
  const queue = (h: string) => {
    pending = h.startsWith('#') ? h : `#${h}`
  }
  const loc = {
    get hash() {
      return hash
    },
    set hash(v: string) {
      queue(v)
    },
    pathname: '/MY-REAL-ESTATE-LAB.html',
    search: '',
    protocol: 'file:',
    origin: 'null',
    get href() {
      return `file:///MY-REAL-ESTATE-LAB.html${hash}`
    },
    assign(url: string) {
      queue(url.slice(url.indexOf('#')))
    },
    replace(url: string) {
      queue(url.slice(url.indexOf('#')))
    },
  }
  const fakeHistory = {
    state: null as unknown,
    pushState() {
      throw new DOMException('pushState blocked', 'SecurityError')
    },
    replaceState(s: unknown) {
      fakeHistory.state = s
    },
    go() {},
  }
  const win = {
    location: loc,
    history: fakeHistory,
    document,
    addEventListener: (t: string, l: EventListener) => (listeners[t] ??= new Set()).add(l),
    removeEventListener: (t: string, l: EventListener) => listeners[t]?.delete(l),
    /** 늦게 반영되던 주소 변경이 이제 반영됨 */
    flush() {
      if (pending) {
        hash = pending
        pending = null
        fire('hashchange')
      }
    },
  }
  return win
}

describe('명시적 해시 라우터: 메뉴 클릭 직후 화면이 바뀐다', () => {
  it('홈 → 지역 → 단지 → 가격 비교 → 생활권 → 시세 입력 → 홈 (클릭 직후 주소·제목·내용 확인)', async () => {
    const { App, AppHashRouter } = await loadApp()
    render(
      <AppHashRouter>
        <App />
      </AppHashRouter>,
    )
    expect(h1()).toBe('전국 시장 현황')
    const steps: [string, string, string, RegExp][] = [
      ['지역', '#/regions', '지역', /시·도 → 시·군·구/],
      ['단지', '#/apartments', '랜드마크 아파트', /대표 면적/],
      ['가격 비교', '#/compare', '랜드마크 가격 비교', /비교 목록/],
      ['생활권', '#/areas', '생활권', /행정구역과 별개로/],
      ['시세 입력', '#/input', '시세 직접 입력', /단지·면적/],
      ['홈', '#/', '전국 시장 현황', /마지막 데이터 업데이트/],
    ]
    for (const [menu, hash, title, content] of steps) {
      clickMenu(menu)
      // 기다리지 않고 바로 확인
      expect(window.location.hash, `${menu} 주소`).toBe(hash)
      expect(h1(), `${menu} 제목`).toBe(title)
      expect(screen.getAllByText(content).length, `${menu} 내용`).toBeGreaterThan(0)
      expect(screen.queryByRole('alert')).toBeNull()
    }
  })

  it('뒤로 가기 · 앞으로 가기 · 주소창 직접 변경이 화면에 반영된다', async () => {
    const { App, AppHashRouter } = await loadApp()
    render(
      <AppHashRouter>
        <App />
      </AppHashRouter>,
    )
    clickMenu('지역')
    clickMenu('단지')
    expect(h1()).toBe('랜드마크 아파트')
    // 브라우저 뒤로 가기와 같은 효과: 주소를 바꾸고 popstate 발생
    await act(async () => {
      window.history.replaceState(null, '', '#/regions')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(h1()).toBe('지역')
    await act(async () => {
      window.history.replaceState(null, '', '#/apartments')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(h1()).toBe('랜드마크 아파트')
    // 주소창에서 직접 #/backup 입력 → hashchange
    await act(async () => {
      window.history.replaceState(null, '', '#/backup')
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(h1()).toBe('백업 · 복원')
  })

  it('새로고침(다시 마운트)해도 현재 페이지가 유지된다', async () => {
    const { App, AppHashRouter } = await loadApp()
    const view = render(
      <AppHashRouter>
        <App />
      </AppHashRouter>,
    )
    clickMenu('후보 노트')
    expect(h1()).toBe('저평가 후보 탐색 노트')
    view.unmount()
    render(
      <AppHashRouter>
        <App />
      </AppHashRouter>,
    )
    expect(h1()).toBe('저평가 후보 탐색 노트')
  })
})

describe('주소 기록이 막히거나 늦게 반영되는 환경 (사용자 증상 재현)', () => {
  async function scenario(Router: ComponentType<{ children: ReactNode; window: Window }>) {
    const { default: App } = await import('@/App')
    const win = adversarialWindow()
    const view = render(
      <Router window={win as unknown as Window}>
        <App />
      </Router>,
    )
    expect(h1()).toBe('전국 시장 현황')
    clickMenu('지역')
    const afterClick = h1()
    await act(async () => win.flush()) // 늦게 반영되던 주소가 이제 #/regions 가 됨
    const afterUrlUpdate = h1()
    const url = win.location.hash
    view.unmount()
    // "새로고침": 같은 주소로 다시 시작
    render(
      <Router window={win as unknown as Window}>
        <App />
      </Router>,
    )
    const afterReload = h1()
    cleanup()
    return { afterClick, afterUrlUpdate, url, afterReload }
  }

  it('기존 HashRouter: 주소는 #/regions 인데 화면은 홈 그대로, 새로고침해야 지역이 나온다 (증상 재현)', async () => {
    const r = await scenario(HashRouter as unknown as ComponentType<{ children: ReactNode; window: Window }>)
    expect(r.url).toBe('#/regions')
    expect(r.afterClick).toBe('전국 시장 현황')
    expect(r.afterUrlUpdate).toBe('전국 시장 현황')
    expect(r.afterReload).toBe('지역')
  })

  it('새 라우터: 같은 환경에서도 클릭 즉시 지역 화면, 새로고침 후에도 지역', async () => {
    const { AppHashRouter } = await import('./hashRouter')
    const r = await scenario(AppHashRouter as unknown as ComponentType<{ children: ReactNode; window: Window }>)
    expect(r.afterClick).toBe('지역')
    expect(r.afterUrlUpdate).toBe('지역')
    expect(r.url).toBe('#/regions')
    expect(r.afterReload).toBe('지역')
  })
})

describe('데이터 저장 유지', () => {
  it('입력한 메모가 메뉴 이동과 새로고침 뒤에도 남아 있다', async () => {
    const { App, AppHashRouter } = await loadApp()
    const view = render(
      <AppHashRouter>
        <App />
      </AppHashRouter>,
    )
    fireEvent.change(screen.getByPlaceholderText(/오늘 읽은 뉴스/), { target: { value: '금리 동결 뉴스 메모' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))
    clickMenu('단지')
    clickMenu('홈')
    expect((screen.getByPlaceholderText(/오늘 읽은 뉴스/) as HTMLTextAreaElement).value).toBe('금리 동결 뉴스 메모')
    view.unmount()
    vi.resetModules() // 새로고침처럼 저장소에서 다시 읽기
    const again = await loadApp()
    render(
      <again.AppHashRouter>
        <again.App />
      </again.AppHashRouter>,
    )
    expect((screen.getByPlaceholderText(/오늘 읽은 뉴스/) as HTMLTextAreaElement).value).toBe('금리 동결 뉴스 메모')
    expect(JSON.parse(localStorage.getItem('mrel:data:v1')!).settings.todayMemo.text).toBe('금리 동결 뉴스 메모')
  })
})
