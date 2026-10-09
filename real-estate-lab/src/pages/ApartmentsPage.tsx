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
import { AGE_LABEL, AREA_LABEL, HOUSEHOLD_LABEL, ageBucket, areaBucket, householdBucket, type AgeBucket, type AreaBucket, type HouseholdBucket } from '@/lib/compare'
import { WON_PER_EOK } from '@/lib/money'
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
  // 비슷한 조건 필터
  const [age, setAge] = useState<AgeBucket | ''>('')
  const [hh, setHh] = useState<HouseholdBucket | ''>('')
  const [areaB, setAreaB] = useState<AreaBucket | ''>('')
  const [minEok, setMinEok] = useState('')
  const [maxEok, setMaxEok] = useState('')
  const [livingArea, setLivingArea] = useState('')
  const year = new Date().getFullYear()
  const condCount = [age, hh, areaB, minEok, maxEok, livingArea].filter(Boolean).length

  const groupOf = useMemo(() => new Map(data.regions.map((r) => [r.id, r.group])), [data.regions])
  const sidos = data.regions.filter((r) => r.type === 'sido' && (!group || r.group === group))

  const items = useMemo(() => {
    const query = q.trim().replace(/\s/g, '')
    const list = data.apartments
      .filter((a) => !landmarkOnly || a.isLandmark)
      .filter((a) => !group || groupOf.get(a.regionId) === group)
      .filter((a) => !sido || a.regionId === sido || a.regionId.startsWith(`${sido}/`))
      .filter((a) => !query || (a.name + regionPath(data, a.regionId) + (a.address ?? '')).replace(/\s/g, '').includes(query))
      .filter((a) => !age || ageBucket(a.builtYear, year) === age)
      .filter((a) => !hh || householdBucket(a.households) === hh)
      .filter((a) => !livingArea || data.livingAreas.find((l) => l.id === livingArea)?.apartmentIds.includes(a.id))
      .map((a) => summarize(data, a))
      .filter((s) => !areaB || areaBucket(s.unit) === areaB)
      .filter((s) => {
        const lo = minEok ? Number(minEok) * WON_PER_EOK : null
        const hi = maxEok ? Number(maxEok) * WON_PER_EOK : null
        if (lo == null && hi == null) return true
        if (!s.sale) return false
        return (lo == null || s.sale.amountWon >= lo) && (hi == null || s.sale.amountWon <= hi)
      })
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
  }, [data, q, group, sido, sort, landmarkOnly, groupOf, age, hh, areaB, minEok, maxEok, livingArea, year])

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

      <details className="mb-4 rounded-xl border bg-card" open={condCount > 0}>
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">
          비슷한 조건끼리 보기 {condCount > 0 && <span className="ml-1 rounded bg-accent px-1.5 text-xs text-primary">{condCount}개 적용</span>}
        </summary>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4 md:grid-cols-6">
          <Select value={age} onChange={(e) => setAge(e.target.value as AgeBucket | '')} aria-label="연식">
            <option value="">연식 전체</option>
            {Object.entries(AGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={hh} onChange={(e) => setHh(e.target.value as HouseholdBucket | '')} aria-label="세대수">
            <option value="">세대수 전체</option>
            {Object.entries(HOUSEHOLD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Select value={areaB} onChange={(e) => setAreaB(e.target.value as AreaBucket | '')} aria-label="전용면적">
            <option value="">전용면적 전체</option>
            {Object.entries(AREA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input inputMode="decimal" value={minEok} onChange={(e) => setMinEok(e.target.value.replace(/[^\d.]/g, ''))} placeholder="매매 최소(억)" aria-label="매매 최소 억" />
          <Input inputMode="decimal" value={maxEok} onChange={(e) => setMaxEok(e.target.value.replace(/[^\d.]/g, ''))} placeholder="매매 최대(억)" aria-label="매매 최대 억" />
          <Select value={livingArea} onChange={(e) => setLivingArea(e.target.value)} aria-label="생활권">
            <option value="">생활권 전체</option>
            {data.livingAreas.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
          <p className="col-span-2 text-xs text-muted-foreground md:col-span-6">
            면적 필터는 확인된 전용면적만 씁니다(평형만 있는 단지는 '전용면적 미확인'). 가격 필터는 대표 면적의 최신 매매가 기준이며 가격이 없는 단지는 빠집니다.
            {condCount > 0 && (
              <button className="ml-2 underline" onClick={() => { setAge(''); setHh(''); setAreaB(''); setMinEok(''); setMaxEok(''); setLivingArea('') }}>
                조건 초기화
              </button>
            )}
          </p>
        </div>
      </details>

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
