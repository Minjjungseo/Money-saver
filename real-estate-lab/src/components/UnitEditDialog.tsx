import { useEffect, useState } from 'react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Field } from './ApartmentFormDialog'
import { toast } from './toast'
import { checkArea, type Errors } from '@/lib/validate'
import { normalizeArea, updateUnit } from '@/store/ops'
import { update, useData } from '@/store/store'
import type { ApartmentUnit } from '@/store/schema'

/** 평형만 있던 면적에 확인한 전용면적을 채우는 등 면적 정보 수정 */
export function UnitEditDialog({ unit, onClose }: { unit: ApartmentUnit | null; onClose: () => void }) {
  const data = useData()
  const [area, setArea] = useState('')
  const [pyeong, setPyeong] = useState('')
  const [label, setLabel] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  useEffect(() => {
    setArea(unit?.exclusiveArea?.toString() ?? '')
    setPyeong(unit?.pyeong?.toString() ?? '')
    setLabel(unit?.label ?? '')
    setErrors({})
  }, [unit])
  if (!unit) return null

  function save() {
    if (!unit) return
    const e: Errors = {}
    if (area.trim()) {
      const ae = checkArea(area)
      if (ae) e.area = ae
    }
    if (pyeong.trim() && !/^\d{1,3}(\.\d)?$/.test(pyeong.trim())) e.pyeong = '숫자로 입력하세요 (예: 34)'
    if (!area.trim() && !pyeong.trim()) e.area = '전용면적 또는 평형 중 하나는 입력하세요'
    const a = area.trim() ? normalizeArea(Number(area)) : null
    const dup = data.units.find(
      (u) => u.id !== unit.id && u.apartmentId === unit.apartmentId && a != null && u.exclusiveArea === a && (u.label ?? '').toUpperCase() === label.trim().toUpperCase(),
    )
    if (dup) e.area = '같은 단지에 같은 전용면적·타입이 이미 있습니다'
    setErrors(e)
    if (Object.keys(e).length) return
    update((d) => updateUnit(d, unit.id, { exclusiveArea: a, pyeong: pyeong.trim() ? Number(pyeong) : null, label: label.trim() || null }), {
      undoLabel: '면적 정보 수정',
    })
    toast('면적 정보를 수정했습니다')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="면적 정보 수정"
      description="가격 기록은 그대로 유지됩니다. 기존 시트의 평형은 공급면적 기준이니, 전용면적은 국토부 실거래가 등에서 확인한 값을 넣으세요."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save}>저장</Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <Field label="전용면적(㎡)" error={errors.area}>
          <Input inputMode="decimal" value={area} onChange={(e) => setArea(e.target.value)} placeholder="84.97" />
        </Field>
        <Field label="평형" error={errors.pyeong}>
          <Input inputMode="numeric" value={pyeong} onChange={(e) => setPyeong(e.target.value)} placeholder="34" />
        </Field>
        <Field label="타입">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="84A" />
        </Field>
      </div>
    </Dialog>
  )
}
