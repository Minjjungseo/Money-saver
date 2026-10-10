import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, MemoryRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'

/**
 * 보통은 주소 뒤 #/경로 방식(HashRouter). 미리보기 창처럼 주소가 about:srcdoc 인 환경에서는
 * 주소를 바꿀 수 없어 메모리 라우터로 대신한다 (새로고침하면 홈으로 돌아감).
 */
const Router = typeof window !== 'undefined' && window.location.protocol === 'about:' ? MemoryRouter : HashRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <Router>
        <App />
      </Router>
    </ErrorBoundary>
  </StrictMode>,
)
