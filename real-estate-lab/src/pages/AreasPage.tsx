import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, Td, Th } from '@/components/ui/table'
import { AreaFormDialog } from '@/components/AreaFormDialog'
import { EmptyState, PageHeader, PriceTypeBadge, Warn } from '@/components/bits'
import { Segmented } from '@/components/Segmented'
import { bandOf, summarizeArea, type AreaSummary } from '@/lib/compare'
import { formatDate } from '@/lib/date'
import { formatEok } from '@/lib/money'
import { apartmentUrl } from '@/lib/routes'
import { useData } from '@/store/store'
import type { LivingArea } from '@/store/schema'

type Sort = 'median' | 'rep' | 'max'
type Basis = 'area' | 'apartment'

export function AreasPage() {
  const data = useData()
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState<Sort>('median')
  const [step, setStep] = useState<'3' | '5' | '10'>('5')
  const [basis, setBasis] = useState<Basis>('area')

  const rows = useMemo(
    () => data.livingAreas.map((area) => ({ area, s: summarizeArea(data, area.apartmentIds, area.representativeId) })),
    [data],
  )
  const value = (r: { s: AreaSummary }) =>
    sort === 'median' ? r.s.medianWon : sort === 'rep' ? (r.s.representative?.sale?.amountWon ?? null) : (r.s.max?.sale?.amountWon ?? null)
  const ranked = [...rows].sort((a, b) => (value(b) ?? -1) - (value(a) ?? -1))

  // 가격 구간 그룹핑
  const bands = useMemo(() => {
    const m = new Map<number, { label: string; items: { key: string; name: string; sub: string; won: number; href: string }[] }>()
    const push = (won: number, item: { key: string; name: string; sub: string; href: string }) => {
      const b = bandOf(won, Number(step))
      const g = m.get(b.lo) ?? { label: b.label, items: [] }
      g.items.push({ ...item, won })
      m.set(b.lo, g)
    }
    if (basis === 'area') {
      for (const r of rows) if (r.s.medianWon != null) push(r.s.medianWon, { key: r.area.id, name: r.area.name, sub: `단지 ${r.s.priced.length}개 중앙값`, href: `/areas/${r.area.id}` })
    } else {
      const seen = new Set<string>()
      for (const r of rows)
        for (const mbr of r.s.priced) {
          if (seen.has(mbr.apartment.id)) continue
          seen.add(mbr.apartment.id)
          push(mbr.sale!.amountWon, { key: mbr.apartment.id, name: mbr.apartment.name, sub: r.area.name, href: apartmentUrl(mbr.apartment.id) })
        }
    }
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([, g]) => ({ ...g, items: g.items.sort((x, y) => y.won - x.won) }))
  }, [rows, step, basis])

  return (
    <>
      <PageHeader
        title="생활권"
        description="행정구역과 별개로 직접 묶은 단지 그룹입니다. 가격은 각 단지 대표 면적의 최신 매매가(실거래가 우선)입니다."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            생활권 만들기
          </Button>
        }
      />

      {data.livingAreas.length === 0 ? (
        <EmptyState title="아직 만든 생활권이 없습니다" action={<Button onClick={() => setOpen(true)}>생활권 만들기</Button>}>
          예: "판교·분당", "목동 학군지", "강남 3구 대체지"처럼 내가 비교하고 싶은 기준으로 단지를 묶어 보세요.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>생활권 순위</CardTitle>
                <CardDescription>가격 기준일·유형이 섞여 있을 수 있으니 오른쪽 칸을 함께 보세요.</CardDescription>
              </div>
              <Segmented value={sort} onChange={setSort} label="정렬" options={[['median', '중앙값'], ['rep', '대표 단지'], ['max', '최고가']]} />
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              <Table>
                <thead>
                  <tr>
                    <Th className="pl-4 sm:pl-5">순위</Th>
                    <Th>생활권</Th>
                    <Th>대표 단지</Th>
                    <Th className="text-right">가격대 (최저~최고)</Th>
                    <Th className="text-right">중앙값</Th>
                    <Th>가격 유형</Th>
                    <Th className="pr-4 sm:pr-5">기준일 범위</Th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((r, i) => (
                    <AreaRow key={r.area.id} rank={value(r) == null ? null : i + 1} area={r.area} s={r.s} />
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>가격 구간별 그룹</CardTitle>
                <CardDescription>{basis === 'area' ? '생활권 중앙값' : '개별 단지 매매가'} 기준으로 {step}억 단위 구간에 나눴습니다.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Segmented value={basis} onChange={setBasis} label="기준" options={[['area', '생활권'], ['apartment', '단지']]} />
                <Segmented value={step} onChange={setStep} label="구간" options={[['3', '3억'], ['5', '5억'], ['10', '10억']]} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {bands.length === 0 && <p className="text-sm text-muted-foreground">데이터 없음</p>}
              {bands.map((b) => (
                <div key={b.label} className="rounded-lg border p-3">
                  <div className="mb-2 text-sm font-semibold">{b.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {b.items.map((it) => (
                      <Link key={it.key} to={it.href} className="rounded-md border bg-card px-2 py-1 text-xs hover:border-primary">
                        <span className="font-medium">{it.name}</span> <span className="tabular">{formatEok(it.won)}</span>
                        <span className="ml-1 text-muted-foreground">{it.sub}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          {rows.some((r) => r.s.types.size > 1) && <Warn>일부 생활권은 실거래가·호가·기타가 섞인 가격으로 계산되었습니다. 같은 유형으로 맞추면 비교가 더 정확해집니다.</Warn>}
        </div>
      )}
      <AreaFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function AreaRow({ rank, area, s }: { rank: number | null; area: LivingArea; s: AreaSummary }) {
  return (
    <tr className="hover:bg-muted/40">
      <Td className="pl-4 tabular sm:pl-5">{rank ?? '—'}</Td>
      <Td>
        <Link to={`/areas/${area.id}`} className="font-medium hover:underline">
          {area.name}
        </Link>
        <div className="text-xs text-muted-foreground">
          단지 {s.members.length}개{s.priced.length < s.members.length ? ` · 가격 없음 ${s.members.length - s.priced.length}` : ''}
        </div>
      </Td>
      <Td className="whitespace-nowrap">
        {s.representative ? (
          <>
            <div>{s.representative.apartment.name}</div>
            <div className="text-xs text-muted-foreground">{s.representative.sale ? formatEok(s.representative.sale.amountWon) : '가격 없음'}</div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">미지정</span>
        )}
      </Td>
      <Td className="text-right whitespace-nowrap tabular">
        {s.min && s.max ? `${formatEok(s.min.sale!.amountWon)} ~ ${formatEok(s.max.sale!.amountWon)}` : '데이터 없음'}
      </Td>
      <Td className="text-right whitespace-nowrap font-semibold tabular">{s.medianWon != null ? formatEok(s.medianWon) : '—'}</Td>
      <Td className="whitespace-nowrap">
        <span className="flex gap-1">
          {[...s.types].map((t) => (
            <PriceTypeBadge key={t} type={t} />
          ))}
        </span>
      </Td>
      <Td className="pr-4 whitespace-nowrap text-xs text-muted-foreground sm:pr-5">
        {s.oldestBasis ? (s.oldestBasis === s.latestBasis ? formatDate(s.latestBasis) : `${formatDate(s.oldestBasis)} ~ ${formatDate(s.latestBasis)}`) : '—'}
      </Td>
    </tr>
  )
}
