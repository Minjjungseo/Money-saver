import { useMemo } from 'react'
import { Select } from './ui/input'
import { REGION_GROUP_LABEL, type AppData, type RegionGroup } from '@/store/schema'

interface Props {
  data: AppData
  value: string
  onChange: (regionId: string) => void
  id?: string
  invalid?: boolean
}

/** 시·도 → 시·군·구(하위 일반구 포함) 2단 선택 */
export function RegionPicker({ data, value, onChange, id, invalid }: Props) {
  const sidos = data.regions.filter((r) => r.type === 'sido')
  const current = data.regions.find((r) => r.id === value)
  const sidoId = current ? (current.type === 'sido' ? current.id : value.split('/')[0]) : ''
  const children = useMemo(() => {
    if (!sidoId) return []
    return data.regions
      .filter((r) => r.id.startsWith(`${sidoId}/`))
      .map((r) => ({ id: r.id, label: r.id.split('/').slice(1).join(' ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
  }, [data.regions, sidoId])

  const groups: RegionGroup[] = ['capital', 'metro', 'local']
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select id={id} aria-invalid={invalid} value={sidoId} onChange={(e) => onChange(e.target.value)}>
        <option value="">시·도 선택</option>
        {groups.map((g) => (
          <optgroup key={g} label={REGION_GROUP_LABEL[g]}>
            {sidos
              .filter((s) => s.group === g)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </optgroup>
        ))}
      </Select>
      <Select aria-label="시·군·구" value={current && current.type !== 'sido' ? value : ''} onChange={(e) => onChange(e.target.value || sidoId)} disabled={!sidoId}>
        <option value="">{children.length ? '시·군·구 (선택)' : '하위 지역 없음'}</option>
        {children.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
