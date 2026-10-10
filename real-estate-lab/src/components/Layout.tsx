import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Building2, DatabaseBackup, GitCompareArrows, Group, Home, Lightbulb, Map as MapIcon, MapPinned, Menu, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasSample } from '@/store/ops'
import { loadWarning, storageMode, useData } from '@/store/store'
import { Toaster } from './toast'
import { ErrorBoundary } from './ErrorBoundary'
import { SampleBadge, Warn } from './bits'

export const NAV = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/regions', label: '지역', icon: MapPinned },
  { to: '/apartments', label: '단지', icon: Building2 },
  { to: '/compare', label: '가격 비교', icon: GitCompareArrows },
  { to: '/map', label: '지도', icon: MapIcon },
  { to: '/areas', label: '생활권', icon: Group },
  { to: '/candidates', label: '후보 노트', icon: Lightbulb },
  { to: '/input', label: '시세 입력', icon: PenLine },
  { to: '/backup', label: '백업', icon: DatabaseBackup },
]

/** 모바일 하단 탭 (나머지는 '더보기') */
const MOBILE_NAV = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/apartments', label: '단지', icon: Building2 },
  { to: '/compare', label: '비교', icon: GitCompareArrows },
  { to: '/input', label: '입력', icon: PenLine },
  { to: '/more', label: '더보기', icon: Menu },
]

export function Layout() {
  const data = useData()
  const { pathname } = useLocation()
  // 주의: 중괄호로 감싸 반환값을 버린다. 최신 브라우저는 scrollTo가 Promise를 반환하는데,
  // 이를 그대로 반환하면 React가 정리 함수로 호출하다가 앱 전체가 멈춘다.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <div className="min-h-dvh lg:flex">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-card px-3 py-5 lg:flex">
        <Brand />
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-muted', isActive && 'bg-accent text-primary')
              }
            >
              <n.icon className="size-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-3 text-[11px] leading-relaxed text-muted-foreground">
          개인 공부용 기록 앱입니다. 투자 추천이 아니며, 시세는 직접 입력한 값만 표시합니다.
        </p>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b bg-card/90 px-4 backdrop-blur lg:hidden">
          <Brand />
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-8">
          {storageMode === 'memory' && (
            <div className="mb-4">
              <Warn>이 환경에서는 브라우저 저장소를 쓸 수 없어 입력 내용이 저장되지 않습니다(창을 닫으면 사라짐). 파일을 내려받아 크롬·엣지에서 직접 열어 주세요.</Warn>
            </div>
          )}
          {loadWarning && (
            <div className="mb-4">
              <Warn>{loadWarning}</Warn>
            </div>
          )}
          {hasSample(data) && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
              <SampleBadge />
              <span>화면 테스트용 가상 단지·가격이 포함되어 있습니다. 실제 시세가 아닙니다.</span>
              <NavLink to="/backup" className="font-medium underline">
                예시 데이터 지우기
              </NavLink>
            </div>
          )}
          {/* 화면(경로)마다 오류를 따로 가둔다: 한 화면에서 오류가 나도 메뉴와 다른 화면은 그대로 동작 */}
          <ErrorBoundary key={pathname} scope="page">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] text-slate-500', isActive && 'text-primary')}
          >
            <n.icon className="size-5" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <Toaster />
    </div>
  )
}

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2 px-1">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="7" fill="#1e3a8a" />
        <path d="M7 24V14l5-4 5 4v10M17 24V9l8-3v18" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
      </svg>
      <span className="text-sm font-bold tracking-tight text-primary">MY REAL ESTATE LAB</span>
    </NavLink>
  )
}
