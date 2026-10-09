import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/bits'
import { regionUrl } from '@/lib/routes'
import { cn } from '@/lib/utils'
import { useData } from '@/store/store'
import { REGION_GROUP_LABEL, type RegionGroup } from '@/store/schema'

type Tab = RegionGroup | 'all'

export function RegionsPage() {
  const data = useData()
  const [tab, setTab] = useState<Tab>('all')
  const [q, setQ] = useState('')

  /** 지역별 단지 수 (하위 지역 포함) */
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of data.apartments) {
      const parts = a.regionId.split('/')
      for (let i = 1; i <= parts.length; i++) {
        const id = parts.slice(0, i).join('/')
        m.set(id, (m.get(id) ?? 0) + 1)
      }
    }
    return m
  }, [data.apartments])

  const sidos = data.regions.filter((r) => r.type === 'sido' && (tab === 'all' || r.group === tab))
  const query = q.trim()

  return (
    <>
      <PageHeader title="지역" description="시·도 → 시·군·구 순서로 정리했습니다. 지역을 누르면 그 지역의 단지를 볼 수 있어요." />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['all', 'capital', 'metro', 'local'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground', tab === t && 'bg-card text-primary shadow-sm')}
            >
              {t === 'all' ? '전체' : REGION_GROUP_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="지역 검색 (예: 강남, 수원)" className="pl-9" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {sidos.map((s) => {
          const children = data.regions.filter((r) => r.id.startsWith(`${s.id}/`) && (!query || r.name.includes(query) || s.name.includes(query)))
          if (query && !s.name.includes(query) && children.length === 0) return null
          return (
            <Card key={s.id}>
              <CardHeader>
                <CardTitle>
                  <Link to={regionUrl(s.id)} className="hover:underline">
                    {s.name}
                  </Link>
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{REGION_GROUP_LABEL[s.group]}</span>
                </CardTitle>
                <span className="text-xs text-muted-foreground">단지 {counts.get(s.id) ?? 0}</span>
              </CardHeader>
              <CardContent>
                {children.length === 0 ? (
                  <p className="text-xs text-muted-foreground">하위 지역이 등록되지 않았습니다. 지역 화면에서 추가할 수 있어요.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {children.map((c) => {
                      const n = counts.get(c.id) ?? 0
                      return (
                        <Link
                          key={c.id}
                          to={regionUrl(c.id)}
                          className={cn(
                            'rounded-md border px-2 py-1 text-xs hover:border-primary hover:text-primary',
                            n > 0 ? 'border-primary/30 bg-accent font-medium text-primary' : 'text-slate-600',
                          )}
                        >
                          {c.id.split('/').slice(1).join(' ')}
                          {n > 0 && <span className="ml-1 tabular">{n}</span>}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
