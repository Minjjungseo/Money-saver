/**
 * 명시적 해시 라우터.
 *
 * React Router의 HashRouter는 메뉴 클릭 시 ① URL을 먼저 바꾸고 ② 그 URL을 다시 읽어
 * ③ React.startTransition(지연 가능한 업데이트)으로 화면을 바꾼다. 이 구조에서는
 *  - history.pushState가 막힌 환경에서 location.assign 후 URL을 다시 읽을 때 아직 예전 주소가 읽히거나
 *  - 트랜지션이 커밋되지 못하면
 * "주소는 바뀌었는데 화면은 그대로이고, 새로고침하면 그 화면이 나오는" 상태가 된다.
 *
 * 이 라우터는 순서를 뒤집는다: 클릭 → React 상태를 즉시(동기) 변경 → 그 다음 URL 기록(실패해도 화면은 이미 바뀜).
 * 뒤로/앞으로 가기는 hashchange·popstate 둘 다 듣고 현재 주소와 상태를 맞춘다.
 * React Router의 저수준 <Router>에 연결하므로 기존 Link·NavLink·useNavigate·useParams는 그대로 동작한다.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavigationType, Router, createPath, parsePath, type Location, type To } from 'react-router-dom'

let keySeq = 0
const nextKey = () => `k${++keySeq}`

function toPathString(to: To): string {
  const s = typeof to === 'string' ? to : createPath({ pathname: to.pathname ?? '/', search: to.search ?? '', hash: to.hash ?? '' })
  return s.startsWith('/') ? s : `/${s}`
}

function makeLocation(path: string, state: unknown = null): Location {
  const p = parsePath(path)
  return { pathname: p.pathname || '/', search: p.search || '', hash: p.hash || '', state, key: nextKey() }
}

/** 지금 주소창의 #/... 부분을 위치로 읽는다 */
export function readHashLocation(win: Window = window): Location {
  let raw = ''
  try {
    raw = win.location.hash.replace(/^#/, '')
  } catch {
    /* 주소를 읽을 수 없는 환경 */
  }
  return makeLocation(raw ? (raw.startsWith('/') ? raw : `/${raw}`) : '/')
}

/** 미리보기(about:srcdoc)처럼 주소를 바꿀 수 없는 환경이면 false */
function canWriteUrl(win: Window): boolean {
  try {
    return win.location.protocol !== 'about:'
  } catch {
    return false
  }
}

function writeUrl(win: Window, mode: 'push' | 'replace', path: string, idx: number): void {
  if (!canWriteUrl(win)) return
  const url = `#${path}`
  try {
    if (mode === 'push') win.history.pushState({ mrelIdx: idx }, '', url)
    else win.history.replaceState({ mrelIdx: idx }, '', url)
    return
  } catch {
    /* pushState가 막힌 환경 → 아래에서 해시만 직접 바꾼다 */
  }
  try {
    if (mode === 'push') win.location.hash = path
    else win.location.replace(url)
  } catch {
    /* 주소 기록 실패: 화면 전환은 이미 끝났으므로 무시 (새로고침하면 홈부터) */
  }
}

interface RouterState {
  action: NavigationType
  location: Location
}

export function AppHashRouter({ children, window: win = window }: { children: ReactNode; window?: Window }) {
  const [state, setState] = useState<RouterState>(() => ({ action: NavigationType.Pop, location: readHashLocation(win) }))
  const current = useRef(state.location)
  current.current = state.location
  const idx = useRef(0)

  const navigator = useMemo(
    () => ({
      createHref: (to: To) => `#${toPathString(to)}`,
      encodeLocation: (to: To) => {
        const p = typeof to === 'string' ? parsePath(to) : to
        return { pathname: p.pathname ?? '', search: p.search ?? '', hash: p.hash ?? '' }
      },
      push: (to: To, routeState?: unknown) => {
        const path = toPathString(to)
        const location = makeLocation(path, routeState ?? null)
        current.current = location
        // ① 화면 먼저 (동기 상태 변경, 트랜지션 아님)
        setState({ action: NavigationType.Push, location })
        // ② 주소 기록
        writeUrl(win, 'push', path, ++idx.current)
      },
      replace: (to: To, routeState?: unknown) => {
        const path = toPathString(to)
        const location = makeLocation(path, routeState ?? null)
        current.current = location
        setState({ action: NavigationType.Replace, location })
        writeUrl(win, 'replace', path, idx.current)
      },
      go: (delta: number) => {
        try {
          win.history.go(delta)
        } catch {
          /* 무시 */
        }
      },
    }),
    [win],
  )

  // 뒤로/앞으로 가기, 주소창 직접 수정, bfcache 복귀 → 주소 기준으로 화면을 맞춘다
  useEffect(() => {
    const sync = () => {
      const loc = readHashLocation(win)
      if (createPath(loc) !== createPath(current.current)) {
        current.current = loc
        setState({ action: NavigationType.Pop, location: loc })
      }
    }
    win.addEventListener('popstate', sync)
    win.addEventListener('hashchange', sync)
    win.addEventListener('pageshow', sync)
    return () => {
      win.removeEventListener('popstate', sync)
      win.removeEventListener('hashchange', sync)
      win.removeEventListener('pageshow', sync)
    }
  }, [win])

  return (
    <Router location={state.location} navigationType={state.action} navigator={navigator} useTransitions={false}>
      {children}
    </Router>
  )
}
