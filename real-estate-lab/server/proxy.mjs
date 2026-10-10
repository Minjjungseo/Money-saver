/**
 * 로컬 실거래가 프록시 + 앱 실행 서버
 *
 *   npm run molit:server   →  http://127.0.0.1:8787 에서 앱을 연다
 *
 * - 인증키는 이 프로그램(내 컴퓨터) 안에서만 쓰고 브라우저에는 절대 보내지 않는다.
 * - 127.0.0.1(내 컴퓨터)에서만 접속 가능. 같은 와이파이의 다른 기기에서도 열리지 않는다.
 * - GET /api/molit/sale?lawd=11650&ym=202609   매매
 *   GET /api/molit/rent?lawd=11650&ym=202609   전월세
 *   GET /api/molit/health                       키 설정 여부(키 값은 보여주지 않음)
 * - 그 외 경로는 dist-single/index.html (단일 파일 앱)을 보여준다.
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, fetchMonth, loadServiceKey } from './molit.mjs'

const PORT = Number(process.env.MOLIT_PORT ?? 8787)
const APP = join(ROOT, 'dist-single', 'index.html')

let key = null
try {
  key = loadServiceKey()
} catch (e) {
  console.warn(`⚠ ${e.message}`)
}

const send = (res, status, body, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`)
  if (req.method !== 'GET') return send(res, 405, { error: 'GET만 허용' })
  if (url.pathname === '/api/molit/health') return send(res, 200, { keyConfigured: !!key })
  const m = /^\/api\/molit\/(sale|rent)$/.exec(url.pathname)
  if (m) {
    const lawd = url.searchParams.get('lawd') ?? ''
    const ym = url.searchParams.get('ym') ?? ''
    if (!/^\d{5}$/.test(lawd) || !/^\d{6}$/.test(ym)) return send(res, 400, { error: 'lawd(5자리), ym(YYYYMM)이 필요합니다' })
    if (!key) return send(res, 503, { error: '인증키가 설정되지 않았습니다 (.env.local 의 MOLIT_SERVICE_KEY)' })
    try {
      const r = await fetchMonth(m[1], lawd, ym, key)
      const { sampleRaw: _omit, ...safe } = r
      return send(res, 200, safe)
    } catch (e) {
      return send(res, 502, { error: e.message })
    }
  }
  if (!existsSync(APP)) return send(res, 404, '앱 파일이 없습니다. 먼저 npm run build:single 을 실행하세요.', 'text/plain; charset=utf-8')
  return send(res, 200, readFileSync(APP, 'utf8'), 'text/html; charset=utf-8')
}).listen(PORT, '127.0.0.1', () => {
  console.log(`MY REAL ESTATE LAB 실행 중: http://127.0.0.1:${PORT}`)
  console.log(`실거래가 인증키: ${key ? '설정됨' : '없음 — .env.local 확인'}  (종료: Ctrl + C)`)
})
