import { useEffect, useState } from 'react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input, Select, Textarea } from './ui/input'
import { Field } from './ApartmentFormDialog'
import { updatePrice } from '@/store/ops'
import { update } from '@/store/store'
import { PRICE_KIND_LABEL, PRICE_TYPE_LABEL, type PriceRecord, type PriceType } from '@/store/schema'
import { parseEok, wonToEokInput } from '@/lib/money'
import { checkDate, checkUrl, type Errors } from '@/lib/validate'
import { toast } from './toast'

export function PriceEditDialog({ record, onClose }: { record: PriceRecord | null; onClose: () => void }) {
  const [f, setF] = useState(() => init(record))
  const [errors, setErrors] = useState<Errors>({})
  useEffect(() => {
    setF(init(record))
    setErrors({})
  }, [record])
  if (!record) return null
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))

  function save() {
    if (!record) return
    const e: Errors = {}
    const amt = parseEok(f.amount)
    if (!amt.ok) e.amount = amt.error
    const sd = checkDate(f.surveyDate, '조사일', { required: true })
    if (sd) e.surveyDate = sd
    const dd = checkDate(f.dealDate, '거래일')
    if (dd) e.dealDate = dd
    const u = checkUrl(f.sourceUrl)
    if (u) e.sourceUrl = u
    setErrors(e)
    if (Object.keys(e).length || !amt.ok) return
    update(
      (d) =>
        updatePrice(d, record.id, {
          amountWon: amt.won,
          surveyDate: f.surveyDate,
          dealDate: f.dealDate || null,
          priceType: f.priceType as PriceType,
          sourceUrl: f.sourceUrl.trim() || null,
          memo: f.memo.trim() || null,
          legacy: f.legacy,
        }),
      { undoLabel: '가격 기록 수정' },
    )
    toast('가격 기록을 수정했습니다')
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${PRICE_KIND_LABEL[record.kind]} 기록 수정`}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${PRICE_KIND_LABEL[record.kind]}가격 (억 원) *`} error={errors.amount}>
            <Input inputMode="decimal" value={f.amount} onChange={(e) => set('amount')(e.target.value)} aria-invalid={!!errors.amount} />
          </Field>
          <Field label="가격 유형">
            <Select value={f.priceType} onChange={(e) => set('priceType')(e.target.value)}>
              {Object.entries(PRICE_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="거래일·기준일" error={errors.dealDate}>
            <Input type="date" value={f.dealDate} onChange={(e) => set('dealDate')(e.target.value)} />
          </Field>
          <Field label="조사일 *" error={errors.surveyDate}>
            <Input type="date" value={f.surveyDate} onChange={(e) => set('surveyDate')(e.target.value)} />
          </Field>
        </div>
        <Field label="출처 URL" error={errors.sourceUrl}>
          <Input value={f.sourceUrl} onChange={(e) => set('sourceUrl')(e.target.value)} placeholder="https://" />
        </Field>
        <Field label="메모">
          <Textarea value={f.memo} onChange={(e) => set('memo')(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.legacy} onChange={(e) => setF((s) => ({ ...s, legacy: e.target.checked }))} className="size-4 accent-primary" />
          과거 자료 (가격 기준 불명확)
        </label>
      </div>
    </Dialog>
  )
}

function init(r: PriceRecord | null) {
  return {
    amount: r ? wonToEokInput(r.amountWon) : '',
    surveyDate: r?.surveyDate ?? '',
    dealDate: r?.dealDate ?? '',
    priceType: r?.priceType ?? 'actual',
    sourceUrl: r?.sourceUrl ?? '',
    memo: r?.memo ?? '',
    legacy: r?.legacy ?? false,
  }
}
