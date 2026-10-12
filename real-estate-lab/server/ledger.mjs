/**
 * 실거래 원장 (2층): server/data/trades/{sale|rent}-{지역코드}-{YYYYMM}.json
 *
 * - 국토부 한 달치 응답을 tradeId 를 붙여 그대로 보관한다(84㎡대가 아닌 거래도 보관 — 나중에 다른 면적 비교에 재사용).
 * - 같은 달을 다시 받으면 새 응답으로 바꾸되, 내용이 달라졌으면 이전 파일을 history/ 에 남긴다(지우지 않음).
 *   해제 신고·늦은 신고가 반영되는 정상적인 갱신이므로 덮어쓰기 전에 항상 보관한다.
 * - 기존 Google Sheets·앱의 가격 기록과는 완전히 분리되어 있다.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assignTradeIds } from './kukpyeong.mjs'

const fingerprint = (items) =>
  JSON.stringify(items.map((t) => [t.tradeId, t.cancelled ?? null, t.cancelDate ?? null, t.contractType ?? null]).sort())

/** @returns {'new'|'same'|'updated'} */
export function saveMonth(dir, { kind, lawdCd, ym, items, fetchedAt }, now = new Date()) {
  mkdirSync(join(dir, 'history'), { recursive: true })
  const name = `${kind}-${lawdCd}-${ym}.json`
  const file = join(dir, name)
  const withIds = assignTradeIds(kind, lawdCd, items)
  const next = { kind, lawdCd, ym, fetchedAt: fetchedAt ?? now.toISOString(), count: withIds.length, items: withIds }
  let result = 'new'
  if (existsSync(file)) {
    const prev = JSON.parse(readFileSync(file, 'utf8'))
    if (fingerprint(prev.items) === fingerprint(withIds)) return 'same'
    const stamp = String(prev.fetchedAt ?? now.toISOString()).replace(/[:.]/g, '-')
    renameSync(file, join(dir, 'history', `${name.replace(/\.json$/, '')}.${stamp}.json`))
    result = 'updated'
  }
  writeFileSync(file, JSON.stringify(next))
  return result
}

export function readMonth(dir, kind, lawdCd, ym) {
  const file = join(dir, `${kind}-${lawdCd}-${ym}.json`)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null
}
