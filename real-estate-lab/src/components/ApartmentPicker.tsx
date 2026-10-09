import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Input, Select } from './ui/input'
import { Button } from './ui/button'
import { SampleBadge } from './bits'
import { headlineOf } from '@/lib/calc'
import { formatEok } from '@/lib/money'
import { primaryUnit, regionPath } from '@/lib/selectors'
import type { AppData, ID } from '@/store/schema'

interface Props {
  data: AppData
  /** 이미 고른 단지 (목록에서 '추가됨'으로 표시) */
  selected: ID[]
  onPick: (apartmentId: ID) => void
  disabled?: boolean
  limit?: number
  actionLabel?: string
}

/** 검색 + 시·도 필터로 단지를 골라 추가하는 공통 목록 */
export function ApartmentPicker({ data, selected, onPick, disabled, limit = 30, actionLabel = '추가' }: Props) {
  const [q, setQ] = useState('')
  const [sido, setSido] = useState('')
  const [landmarkOnly, setLandmarkOnly] = useState(true)
  const sidos = data.regions.filter((r) => r.type === 'sido' && data.apartments.some((a) => a.regionId.split('/')[0] === r.id))

  const results = useMemo(() => {
    const query = q.replace(/\s/g, '')
    return data.apartments
      .filter((a) => !landmarkOnly || a.isLandmark)
      .filter((a) => !sido || a.regionId.split('/')[0] === sido)
      .filter((a) => !query || (a.name + regionPath(data, a.regionId)).replace(/\s/g, '').includes(query))
      .sort((a, b) => a.regionId.localeCompare(b.regionId, 'ko') || a.name.localeCompare(b.name, 'ko'))
  }, [data, q, sido, landmarkOnly])

  return (
    <div>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <div className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="단지명·지역 검색" className="pl-9" />
        </div>
        <Select value={sido} onChange={(e) => setSido(e.target.value)} aria-label="시도">
          <option value="">전체 시·도</option>
          {sidos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm">
          <input type="checkbox" checked={landmarkOnly} onChange={(e) => setLandmarkOnly(e.target.checked)} className="size-4 accent-primary" />
          대표 단지만
        </label>
      </div>
      <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border bg-card">
        {results.slice(0, limit).map((a) => {
          const u = primaryUnit(data, a.id)
          const sale = u ? headlineOf(data.prices, u.id, 'sale') : null
          const picked = selected.includes(a.id)
          return (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate font-medium">
                  {a.name} <SampleBadge show={a.isSample} />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {regionPath(data, a.regionId)} · 매매 {sale ? formatEok(sale.amountWon) : '—'}
                </div>
              </div>
              <Button size="sm" variant={picked ? 'ghost' : 'secondary'} disabled={picked || disabled} onClick={() => onPick(a.id)}>
                {picked ? '추가됨' : (
                  <>
                    <Plus />
                    {actionLabel}
                  </>
                )}
              </Button>
            </li>
          )
        })}
        {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">조건에 맞는 단지가 없습니다</li>}
        {results.length > limit && <li className="px-3 py-2 text-center text-xs text-muted-foreground">{results.length - limit}개 더 있음 — 검색어를 좁혀 주세요</li>}
      </ul>
    </div>
  )
}
