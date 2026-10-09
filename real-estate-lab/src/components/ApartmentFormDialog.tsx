import { useEffect, useState, type ReactNode } from 'react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input, Label, Textarea } from './ui/input'
import { RegionPicker } from './RegionPicker'
import { addApartment, updateApartment } from '@/store/ops'
import { update, useData } from '@/store/store'
import type { Apartment } from '@/store/schema'
import { checkOptionalInt, toOptionalInt, type Errors } from '@/lib/validate'
import { toast } from './toast'

interface Props {
  open: boolean
  onClose: () => void
  /** 수정할 단지. 없으면 새로 추가 */
  apartment?: Apartment
  defaultRegionId?: string
  onSaved?: (a: Apartment) => void
}

export function ApartmentFormDialog({ open, onClose, apartment, defaultRegionId, onSaved }: Props) {
  const data = useData()
  const [f, setF] = useState(() => init(apartment, defaultRegionId))
  const [errors, setErrors] = useState<Errors>({})
  useEffect(() => {
    if (open) {
      setF(init(apartment, defaultRegionId))
      setErrors({})
    }
  }, [open, apartment, defaultRegionId])

  const set = (k: keyof typeof f) => (v: string | boolean) => setF((s) => ({ ...s, [k]: v }))

  function save() {
    const e: Errors = {}
    if (!f.regionId) e.regionId = '지역을 선택하세요'
    if (!f.name.trim()) e.name = '단지명을 입력하세요'
    else if (f.name.trim().length > 60) e.name = '60자 이내로 입력하세요'
    const dup = data.apartments.find(
      (a) => a.id !== apartment?.id && a.regionId === f.regionId && a.name.replace(/\s/g, '') === f.name.replace(/\s/g, ''),
    )
    if (dup) e.name = '같은 지역에 같은 이름의 단지가 이미 있습니다'
    const by = checkOptionalInt(f.builtYear, '준공연도', 1960, new Date().getFullYear() + 5)
    if (by) e.builtYear = by
    const hh = checkOptionalInt(f.households, '세대수', 1, 20000)
    if (hh) e.households = hh
    setErrors(e)
    if (Object.keys(e).length) return

    const input = {
      regionId: f.regionId,
      name: f.name.trim(),
      address: f.address.trim() || null,
      builtYear: toOptionalInt(f.builtYear),
      households: toOptionalInt(f.households),
      isLandmark: f.isLandmark,
      memo: f.memo.trim() || null,
    }
    let saved: Apartment
    if (apartment) {
      update((d) => updateApartment(d, apartment.id, input))
      saved = { ...apartment, ...input }
      toast('단지 정보를 수정했습니다')
    } else {
      let created!: Apartment
      update((d) => {
        const r = addApartment(d, input)
        created = r.apartment
        return r.data
      })
      saved = created
      toast('단지를 추가했습니다')
    }
    onSaved?.(saved)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={apartment ? '단지 정보 수정' : '단지 추가'}
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
        <Field label="지역 *" error={errors.regionId}>
          <RegionPicker data={data} value={f.regionId} onChange={set('regionId')} invalid={!!errors.regionId} />
        </Field>
        <Field label="단지명 *" error={errors.name}>
          <Input value={f.name} onChange={(e) => set('name')(e.target.value)} placeholder="예: ○○래미안" aria-invalid={!!errors.name} />
        </Field>
        <Field label="주소">
          <Input value={f.address} onChange={(e) => set('address')(e.target.value)} placeholder="도로명 또는 지번 주소" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="준공연도" error={errors.builtYear}>
            <Input inputMode="numeric" value={f.builtYear} onChange={(e) => set('builtYear')(e.target.value)} placeholder="2009" />
          </Field>
          <Field label="세대수" error={errors.households}>
            <Input inputMode="numeric" value={f.households} onChange={(e) => set('households')(e.target.value)} placeholder="1800" />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isLandmark} onChange={(e) => set('isLandmark')(e.target.checked)} className="size-4 accent-primary" />
          지역 대표(랜드마크) 단지
        </label>
        <Field label="공부 메모">
          <Textarea value={f.memo} onChange={(e) => set('memo')(e.target.value)} placeholder="입지, 학군, 교통, 비교 포인트 등" />
        </Field>
      </div>
    </Dialog>
  )
}

function init(a?: Apartment, regionId?: string) {
  return {
    regionId: a?.regionId ?? regionId ?? '',
    name: a?.name ?? '',
    address: a?.address ?? '',
    builtYear: a?.builtYear?.toString() ?? '',
    households: a?.households?.toString() ?? '',
    isLandmark: a?.isLandmark ?? true,
    memo: a?.memo ?? '',
  }
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
