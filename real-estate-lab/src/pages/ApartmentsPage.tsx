import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { ApartmentFormDialog } from '@/components/ApartmentFormDialog'
import { ApartmentList } from '@/components/ApartmentList'
import { EmptyState, PageHeader } from '@/components/bits'
import { apartmentUrl } from '@/lib/routes'
import { regionPath, summarize, type AptSummary } from '@/lib/selectors'
import { useData } from '@/store/store'
import { REGION_GROUP_LABEL, type RegionGroup } from '@/store/schema'

type Sort = 'name' | 'saleDesc' | 'saleAsc' | 'changeDesc' | 'changeAsc' | 'ratioDesc' | 'recent'

const SORT_LABEL: Record<Sort, string> = {
  name: '이름순',
  saleDesc: '매매가 높은순',
  saleAsc: '매매가 낮은순',
  changeDesc: '상승률 높은순',
  changeAsc: '하락률 높은순',
  ratioDesc: '전세가율 높은순',
  recent: '최근 조사순',
}

/** 값이 없는 항목(null)은 정렬 방향과 상관없이 항상 맨 뒤로 */
function byNullable(get: (s: AptSummary) => number | string | null, dir: 1 | -1) {
  return (a: AptSummary, b: AptSummary) => {
    const x = get(a)
    const y = get(b)
    if (x == null && y == null) return 0
    if (x == null) return 1
    if (y == null) return -1
    return (x < y ? -1 : x > y ? 1 : 0) * dir
  }
}

export function ApartmentsPage() {
  const data = useData()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [group, setGroup] = useState<RegionGroup | ''>('')
  const [sido, setSido] = useState('')
  const [sort, setSort] = useState<Sort>('saleDesc')
  const [landmarkOnly, setLandmarkOnly] = useState(false)
  const [adding, setAdding] = useState(false)

  const groupOf = useMemo(() => new Map(data.regions.map((r) => [r.id, r.group])), [data.regions])
  const sidos = data.regions.filter((r) => r.type === 'sido' && (!group || r.group === group))

  const items = useMemo(() => {
    const query = q.trim().replace(/\s/g, '')
    const list = data.apartments
      .filter((a) => !landmarkOnly || a.isLandmark)
      .filter((a) => !group || groupOf.get(a.regionId) === group)
      .filter((a) => !sido || a.regionId === sido || a.regionId.startsWith(`${sido}/`))
      .filter((a) => !query || (a.name + regionPath(data, a.regionId) + (a.address ?? '')).replace(/\s/g, '').includes(query))
      .map((a) => summarize(data, a))
    const cmp: Record<Sort, (a: AptSummary, b: AptSummary) => number> = {
      name: (a, b) => a.apartment.name.localeCompare(b.apartment.name, 'ko'),
      saleDesc: byNullable((s) => s.sale?.amountWon ?? null, -1),
      saleAsc: byNullable((s) => s.sale?.amountWon ?? null, 1),
      changeDesc: byNullable((s) => s.saleChange?.ratePct ?? null, -1),
      changeAsc: byNullable((s) => s.saleChange?.ratePct ?? null, 1),
      ratioDesc: byNullable((s) => s.ratio, -1),
      recent: byNullable((s) => s.lastSurvey, -1),
    }
    return list.sort(cmp[sort])
  }, [data, q, group, sido, sort, landmarkOnly, groupOf])

  return (
    <>
      <PageHeader
        title="랜드마크 아파트"
        description="대표 면적(기록이 가장 많은 면적)의 최신 실거래가 기준입니다. 실거래가가 없으면 최신 호가·기타를 표시합니다."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus />
            단지 추가
          </Button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative col-span-2 md:col-span-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="단지명·지역·주소 검색" className="pl-9" />
        </div>
        <Select value={group} onChange={(e) => { setGroup(e.target.value as RegionGroup | ''); setSido('') }} aria-label="권역">
          <option value="">전체 권역</option>
          {(['capital', 'metro', 'local'] as RegionGroup[]).map((g) => (
            <option key={g} value={g}>
              {REGION_GROUP_LABEL[g]}
            </option>
          ))}
        </Select>
        <Select value={sido} onChange={(e) => setSido(e.target.value)} aria-label="시도">
          <option value="">전체 시·도</option>
          {sidos.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬">
          {Object.entries(SORT_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <label className="flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm">
          <input type="checkbox" checked={landmarkOnly} onChange={(e) => setLandmarkOnly(e.target.checked)} className="size-4 accent-primary" />
          대표 단지만
        </label>
      </div>

      {data.apartments.length === 0 ? (
        <EmptyState title="등록된 단지가 없습니다" action={<Button onClick={() => setAdding(true)}>단지 추가</Button>} />
      ) : items.length === 0 ? (
        <EmptyState title="조건에 맞는 단지가 없습니다" />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">{items.length}개 단지 · 변동은 직전 기록 대비(같은 면적·같은 가격 유형)</p>
          <ApartmentList data={data} items={items} />
        </>
      )}
      <ApartmentFormDialog open={adding} onClose={() => setAdding(false)} onSaved={(a) => navigate(apartmentUrl(a.id))} />
    </>
  )
}
