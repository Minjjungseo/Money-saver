import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { ApartmentFormDialog, Field } from '@/components/ApartmentFormDialog'
import { ApartmentList } from '@/components/ApartmentList'
import { EmptyState, PageHeader } from '@/components/bits'
import { toast } from '@/components/toast'
import { apartmentUrl, regionUrl } from '@/lib/routes'
import { descendantIds, summarize } from '@/lib/selectors'
import { addRegion } from '@/store/ops'
import { update, useData } from '@/store/store'
import { REGION_GROUP_LABEL, REGION_TYPE_LABEL } from '@/store/schema'

export function RegionDetailPage() {
  const { regionId = '' } = useParams()
  const id = decodeURIComponent(regionId)
  const data = useData()
  const navigate = useNavigate()
  const [addApt, setAddApt] = useState(false)
  const [addSub, setAddSub] = useState(false)
  const region = data.regions.find((r) => r.id === id)

  const items = useMemo(() => {
    if (!region) return []
    const ids = descendantIds(data, region.id)
    return data.apartments.filter((a) => ids.has(a.regionId)).map((a) => summarize(data, a))
  }, [data, region])

  if (!region) return <Navigate to="/regions" replace />

  const crumbs = id.split('/').map((_, i, arr) => arr.slice(0, i + 1).join('/'))
  const children = data.regions.filter((r) => r.parentId === region.id)

  return (
    <>
      <nav className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/regions" className="hover:underline">
          지역
        </Link>
        {crumbs.slice(0, -1).map((c) => (
          <span key={c} className="flex items-center gap-1">
            <ChevronRight className="size-3" />
            <Link to={regionUrl(c)} className="hover:underline">
              {c.split('/').at(-1)}
            </Link>
          </span>
        ))}
      </nav>
      <PageHeader
        title={id.replace(/\//g, ' ')}
        description={`${REGION_TYPE_LABEL[region.type]} · ${REGION_GROUP_LABEL[region.group]}${region.adminCode ? ` · 행정코드 ${region.adminCode}` : ''}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setAddSub(true)}>
              <Plus />
              하위 지역
            </Button>
            <Button onClick={() => setAddApt(true)}>
              <Plus />
              단지 추가
            </Button>
          </>
        }
      />

      {children.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {children.map((c) => (
            <Link key={c.id} to={regionUrl(c.id)} className="rounded-md border bg-card px-2.5 py-1 text-xs hover:border-primary hover:text-primary">
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="이 지역에 등록된 단지가 없습니다" action={<Button onClick={() => setAddApt(true)}>대표 단지 추가</Button>}>
          지역의 랜드마크 아파트를 추가하고 시세를 입력해 보세요.
        </EmptyState>
      ) : (
        <ApartmentList data={data} items={items} />
      )}

      <ApartmentFormDialog open={addApt} onClose={() => setAddApt(false)} defaultRegionId={region.id} onSaved={(a) => navigate(apartmentUrl(a.id))} />
      <AddSubRegionDialog open={addSub} onClose={() => setAddSub(false)} parentId={region.id} parentType={region.type} />
    </>
  )
}

function AddSubRegionDialog({ open, onClose, parentId, parentType }: { open: boolean; onClose: () => void; parentId: string; parentType: string }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const type = parentType === 'sido' ? 'sigungu' : 'gu'
  const save = () => {
    const n = name.trim()
    if (!n) return setErr('이름을 입력하세요')
    if (n.includes('/')) return setErr('"/" 문자는 쓸 수 없습니다')
    update((d) => addRegion(d, parentId, n, type).data)
    toast('지역을 추가했습니다')
    setName('')
    setErr('')
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="하위 지역 추가"
      description={type === 'gu' ? '예: 수원시 아래 영통구' : '예: 시·군·구'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save}>추가</Button>
        </>
      }
    >
      <Field label="지역 이름" error={err}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="영통구" />
      </Field>
    </Dialog>
  )
}
