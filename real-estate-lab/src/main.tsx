import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppHashRouter } from './lib/hashRouter'

/**
 * 주소 뒤 #/경로 방식. 메뉴 클릭 시 화면을 먼저(동기) 바꾸고 주소를 기록하는 명시적 라우터를 쓴다.
 * file:// 로 연 단일 파일, 일반 웹 주소, 주소를 바꿀 수 없는 미리보기 창 모두 같은 코드로 동작한다.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary scope="app">
      <AppHashRouter>
        <App />
      </AppHashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
