/**
 * 기존 Google Sheets(xlsx로 내려받은 2026 공부용 사본) → server/landmarks.json
 *
 * 앱의 시트 가져오기와 같은 규칙(importTrackingSheet)을 그대로 써서 단지 목록만 뽑는다.
 * 가격은 넣지 않는다. 시트의 과거 가격은 앱 안에 그대로 두고, 국토부 조회 결과는 별도 CSV로만 저장한다.
 *
 * 이미 landmarks.json 이 있으면 사용자가 손으로 적은 값(lawdCd, apiNames, areaMin, areaMax, top20)은 유지한다.
 *
 * 실행: npm run molit:landmarks -- 시트파일.xlsx
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readSheet } from 'read-excel-file/node'
import { importTrackingSheet, type SheetRows } from '@/lib/sheetImport'
import { emptyData } from '@/store/storage'
import { TOP20 } from '../server/lawd.mjs'

const file = process.argv[2]
if (!file) {
  console.error('사용법: npm run molit:landmarks -- 시트파일.xlsx')
  process.exit(1)
}
const out = join(process.cwd(), 'server', 'landmarks.json')

const tracking = (await readSheet(file, '시세트래킹')) as SheetRows
const landmark = (await readSheet(file, '전국 랜드마크 가격 순서').catch(() => null)) as SheetRows | null
const { data, rows } = importTrackingSheet(emptyData(), tracking, landmark)

const regionPath = (id: string) => {
  const names: string[] = []
  let r = data.regions.find((x) => x.id === id)
  while (r) {
    names.unshift(r.name)
    r = r.parentId ? data.regions.find((x) => x.id === r!.parentId) : undefined
  }
  return names
}

type Entry = Record<string, unknown> & { key: string }
const prev = new Map<string, Entry>()
if (existsSync(out)) for (const e of JSON.parse(readFileSync(out, 'utf8')).landmarks as Entry[]) prev.set(e.key, e)

const KEEP = ['lawdCd', 'lawdNote', 'apiNames', 'areaMin', 'areaMax', 'top20', 'memo', 'checkNote', 'verified'] as const
const landmarks: Entry[] = rows.map((row) => {
  const apt = data.apartments.find((a) => a.regionId === row.regionId && row.name.startsWith(a.name))!
  const unit = data.units.find((u) => u.apartmentId === apt.id && row.name.includes(`(${u.pyeong ?? ''}`)) ?? data.units.find((u) => u.apartmentId === apt.id)
  const path = regionPath(row.regionId)
  const key = `${path.join('/')}|${row.name}`
  const top = TOP20.find((t) => t.sheetName === row.name)
  const base: Entry = {
    key,
    sheetRow: row.line,
    sheetText: row.name,
    name: apt.name,
    sido: path[0] ?? null,
    sigungu: path.slice(1).join(' ') || null,
    pyeong: unit?.pyeong ?? null,
    pyeongLabel: unit?.label ?? null,
    isLandmark: apt.isLandmark,
    regionNote: row.note,
    lawdCd: top?.lawdCd ?? null,
    top20: top ? top.rank : null,
  }
  const old = prev.get(key)
  if (old) for (const k of KEEP) if (old[k] !== undefined && old[k] !== null) base[k] = old[k]
  return base
})

const missing = TOP20.filter((t) => !landmarks.some((l) => l.top20 === t.rank))
if (missing.length) console.warn('시트에서 찾지 못한 대표 단지:', missing.map((m) => m.sheetName).join(', '))

writeFileSync(
  out,
  JSON.stringify(
    {
      about: '기존 Google Sheets 시세트래킹 탭의 단지 목록 (가격 없음). lawdCd·apiNames·areaMin·areaMax 는 직접 고쳐도 다시 생성할 때 유지됩니다.',
      generatedAt: new Date().toISOString().slice(0, 10),
      sourceFile: file.split(/[\\/]/).pop(),
      landmarks,
    },
    null,
    1,
  ) + '\n',
)
console.log(`단지 ${landmarks.length}개 → ${out} (대표 ${landmarks.filter((l) => l.top20).length}개에 지역코드)`)
