import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input, Textarea } from './ui/input'
import { Field } from './ApartmentFormDialog'
import { ApartmentPicker } from './ApartmentPicker'
import { toast } from './toast'
import { regionPath } from '@/lib/selectors'
import { addLivingArea, updateLivingArea } from '@/store/ops'
import { update, useData } from '@/store/store'
import type { ID, LivingArea } from '@/store/schema'

interface Props {
  open: boolean
  onClose: () => void
  area?: LivingArea
  onSaved?: (id: ID) => void
}

export function AreaFormDialog({ open, onClose, area, onSaved }: Props) {
  const data = useData()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ids, setIds] = useState<ID[]>([])
  const [rep, setRep] = useState<ID | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!open) return
    setName(area?.name ?? '')
    setDescription(area?.description ?? '')
    setIds(area?.apartmentIds ?? [])
    setRep(area?.representativeId ?? null)
    setErr('')
  }, [open, area])

  function save() {
    const n = name.trim()
    if (!n) return setErr('생활권 이름을 입력하세요')
    if (n.length > 40) return setErr('40자 이내로 입력하세요')
    if (data.livingAreas.some((l) => l.id !== area?.id && l.name === n)) return setErr('같은 이름의 생활권이 있습니다')
    const input = { name: n, description, apartmentIds: ids, representativeId: rep }
    let id = area?.id ?? ''
    if (area) update((d) => updateLivingArea(d, area.id, input))
    else
      update((d) => {
        const r = addLivingArea(d, input)
        id = r.area.id
        return r.data
      })
    toast(area ? '생활권을 수정했습니다' : '생활권을 만들었습니다')
    onSaved?.(id)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={area ? '생활권 수정' : '생활권 만들기'}
      description="행정구역과 상관없이, 같이 비교하고 싶은 단지를 묶습니다. 한 단지를 여러 생활권에 넣을 수 있어요."
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save}>저장</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="이름 *" error={err}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 판교·분당 생활권, 목동 학군지" autoFocus />
        </Field>
        <Field label="설명">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="이 생활권을 묶은 기준 (출퇴근권, 학군, 상권 등)" />
        </Field>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">포함된 단지 {ids.length}개 · 대표 단지를 하나 골라 주세요</div>
          {ids.length === 0 ? (
            <p className="mb-2 text-xs text-muted-foreground">아래에서 단지를 추가하세요.</p>
          ) : (
            <ul className="mb-3 max-h-48 divide-y overflow-y-auto rounded-lg border">
              {ids.map((id) => {
                const a = data.apartments.find((x) => x.id === id)
                if (!a) return null
                return (
                  <li key={id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <label className="flex flex-1 items-center gap-2">
                      <input type="radio" name="rep" checked={rep === id} onChange={() => setRep(id)} className="accent-primary" />
                      <span className="font-medium">{a.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{regionPath(data, a.regionId)}</span>
                      {rep === id && <span className="text-xs text-primary">대표</span>}
                    </label>
                    <button aria-label="빼기" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => { setIds(ids.filter((x) => x !== id)); if (rep === id) setRep(null) }}>
                      <X className="size-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <ApartmentPicker data={data} selected={ids} limit={15} onPick={(id) => { setIds([...ids, id]); if (!rep) setRep(id) }} />
        </div>
      </div>
    </Dialog>
  )
}
