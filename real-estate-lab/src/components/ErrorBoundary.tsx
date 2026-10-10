import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, Home, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  /** 'page' = 한 화면만 대체, 'app' = 앱 전체 마지막 안전망 */
  scope: 'page' | 'app'
}

interface State {
  error: Error | null
}

/**
 * 렌더링 중 오류가 나도 앱 전체가 하얗게 되지 않도록 막는다.
 * 저장된 데이터는 건드리지 않는다 (복구 버튼도 화면만 다시 그린다).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MY REAL ESTATE LAB] 화면 오류', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className={this.props.scope === 'app' ? 'mx-auto max-w-xl p-6 pt-16' : 'py-6'}>
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-sm text-orange-950">
          <div className="mb-2 flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="size-5" />
            {this.props.scope === 'app' ? '앱을 표시하는 중 문제가 생겼습니다' : '이 화면을 표시하는 중 문제가 생겼습니다'}
          </div>
          <p>입력한 데이터는 그대로 저장되어 있습니다. 아래 버튼으로 다시 시도하거나 홈으로 이동해 주세요.</p>
          <p className="mt-3 rounded-md bg-white/70 px-3 py-2 font-mono text-xs break-all text-orange-900">{error.message || String(error)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={this.reset} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-orange-200 hover:bg-orange-100">
              <RotateCcw className="size-4" />
              다시 시도
            </button>
            <a
              href="#/"
              onClick={() => setTimeout(this.reset, 0)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-medium ring-1 ring-orange-200 hover:bg-orange-100"
            >
              <Home className="size-4" />
              홈으로
            </a>
            <button onClick={() => window.location.reload()} className="rounded-lg px-3 py-2 text-sm underline">
              새로고침
            </button>
          </div>
          <p className="mt-3 text-xs text-orange-800">계속 같은 문제가 생기면 위 회색 칸의 오류 문구를 알려 주세요.</p>
        </div>
      </div>
    )
  }
}
