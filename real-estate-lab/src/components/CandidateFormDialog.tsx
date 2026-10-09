import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input, Select, Textarea } from './ui/input'
import { Field } from './ApartmentFormDialog'
import { ApartmentPicker } from './ApartmentPicker'
import { Warn } from './bits'
import { toast } from './toast'
import { regionPath, unitChip, unitsOf } from '@/lib/selectors'
import { addCandidate, updateCandidate, type CandidateInput } from '@/store/ops'
import { update, useData } from '@/store/store'
import { CANDIDATE_STATUS_LABEL, type Candidate, type CandidateStatus, type ID, type UnitRef } from '@/store/schema'

interface Props {
  open: boolean
  onClose: () => void
  candidate?: Candidate
  /** 단지 상세에서 열 때 대상 단지 */
  defaultTarget?: UnitRef
}

const empty = (target?: UnitRef): CandidateInput => ({
  target: target ?? { apartmentId: '', unitId: null },
  comparisons: [],
  hypothesis: '',
  evidenceToCheck: '',
  locationDiff: null,
  ageDiff: null,
  areaDiff: null,
  volumeDiff: null,
  status: 'studying',
  conclusion: null,
})

export function CandidateFormDialog({ open, onClose, candidate, defaultTarget }: Props) {
  const data = useData()
  const [f, setF] = useState<CandidateInput>(() => empty(defaultTarget))
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => {
    if (!open) return
    setF(candidate ? { ...candidate } : empty(defaultTarget))
    setErrors({})
  }, [open, candidate, defaultTarget])

  const set = <K extends keyof CandidateInput>(k: K, v: CandidateInput[K]) => setF((s) => ({ ...s, [k]: v }))
  const text = (k: 'locationDiff' | 'ageDiff' | 'areaDiff' | 'volumeDiff' | 'conclusion') => ({
    value: f[k] ?? '',
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => set(k, e.target.value || null),
  })

  function save() {
    const e: Record<string, string> = {}
    if (!f.target.apartmentId) e.target = '공부할 단지를 고르세요'
    if (f.comparisons.length === 0) e.comparisons = '비교 대상 단지를 하나 이상 고르세요'
    if (!f.hypothesis.trim()) e.hypothesis = '왜 저평가라고 생각하는지 가설을 적어 주세요'
    if (!f.evidenceToCheck.trim()) e.evidenceToCheck = '가설을 확인할 근거를 하나 이상 적어 주세요'
    setErrors(e)
    if (Object.keys(e).length) return
    const input = { ...f, hypothesis: f.hypothesis.trim(), evidenceToCheck: f.evidenceToCheck.trim() }
    if (candidate) update((d) => updateCandidate(d, candidate.id, input))
    else update((d) => addCandidate(d, input).data)
    toast(candidate ? '후보 노트를 수정했습니다' : '공부 후보로 저장했습니다')
    onClose()
  }

  const UnitSelect = ({ value: r, onChange }: { value: UnitRef; onChange: (unitId: ID | null) => void }) => {
    const units = unitsOf(data, r.apartmentId)
    if (units.length <= 1) return <span className="text-xs text-muted-foreground">{units[0] ? unitChip(units[0]) : '면적 없음'}</span>
    return (
      <Select className="h-8 w-auto text-xs" value={r.unitId ?? ''} onChange={(e) => onChange(e.target.value || null)} aria-label="면적">
        <option value="">대표 면적</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {unitChip(u)}
          </option>
        ))}
      </Select>
    )
  }
  const aptName = (id: ID) => data.apartments.find((a) => a.id === id)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={candidate ? '저평가 후보 노트 수정' : '저평가 후보로 저장'}
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
      <div className="space-y-4">
        <Warn>앱은 가격 차이만 계산합니다. 싸다는 것만으로 저평가라고 판단하지 않으니, 가설과 확인할 근거를 직접 적어 주세요.</Warn>

        <Field label="공부할 단지 *" error={errors.target}>
          {f.target.apartmentId ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <b>{aptName(f.target.apartmentId)?.name}</b>
              <span className="text-xs text-muted-foreground">{regionPath(data, aptName(f.target.apartmentId)?.regionId ?? '')}</span>
              <UnitSelect value={f.target} onChange={(unitId) => set('target', { ...f.target, unitId })} />
              {!candidate && (
                <button className="ml-auto text-xs text-muted-foreground underline" onClick={() => set('target', { apartmentId: '', unitId: null })}>
                  바꾸기
                </button>
              )}
            </div>
          ) : (
            <ApartmentPicker data={data} selected={[]} limit={10} actionLabel="선택" onPick={(id) => set('target', { apartmentId: id, unitId: null })} />
          )}
        </Field>

        <Field label="비교 대상 단지 *" error={errors.comparisons}>
          {f.comparisons.length > 0 && (
            <ul className="mb-2 divide-y rounded-lg border">
              {f.comparisons.map((c, i) => (
                <li key={c.apartmentId} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="font-medium">{aptName(c.apartmentId)?.name}</span>
                  <UnitSelect value={c} onChange={(unitId) => set('comparisons', f.comparisons.map((x, j) => (j === i ? { ...x, unitId } : x)))} />
                  <button className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted" aria-label="빼기" onClick={() => set('comparisons', f.comparisons.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ApartmentPicker
            data={data}
            selected={[f.target.apartmentId, ...f.comparisons.map((c) => c.apartmentId)]}
            limit={10}
            onPick={(id) => set('comparisons', [...f.comparisons, { apartmentId: id, unitId: null }])}
          />
        </Field>

        <Field label="저평가 가설 *" error={errors.hypothesis}>
          <Textarea value={f.hypothesis} onChange={(e) => set('hypothesis', e.target.value)} placeholder="예: 같은 역세권·같은 학군인데 연식 차이에 비해 가격 차이가 크다" />
        </Field>
        <Field label="확인할 근거 * (한 줄에 하나)" error={errors.evidenceToCheck}>
          <Textarea
            value={f.evidenceToCheck}
            onChange={(e) => set('evidenceToCheck', e.target.value)}
            placeholder={'최근 6개월 실거래가 확인\n학교 배정 확인\n역까지 실제 도보 시간\n거래량 비교'}
            className="min-h-24"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="입지 차이">
            <Textarea {...text('locationDiff')} placeholder="역 거리, 학군, 상권 등" />
          </Field>
          <Field label="연식 차이">
            <Textarea {...text('ageDiff')} placeholder="준공연도, 리모델링·재건축 가능성" />
          </Field>
          <Field label="면적 차이">
            <Textarea {...text('areaDiff')} placeholder="전용면적, 구조(판상형·타워형)" />
          </Field>
          <Field label="거래량 차이 (직접 확인)">
            <Textarea {...text('volumeDiff')} placeholder="최근 거래 건수, 매물 수" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="상태">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as CandidateStatus)}>
              {Object.entries(CANDIDATE_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="확인 결과 · 결론">
            <Input {...text('conclusion')} placeholder="근거를 확인한 뒤 내 결론" />
          </Field>
        </div>
      </div>
    </Dialog>
  )
}
