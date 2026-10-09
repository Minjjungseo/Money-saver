import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, GitCompareArrows, Pencil, Star, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, Td, Th } from '@/components/ui/table'
import { AreaFormDialog } from '@/components/AreaFormDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState, PriceTypeBadge, SampleBadge, Stat } from '@/components/bits'
import { toast } from '@/components/toast'
import { basisDate, currentRatio } from '@/lib/calc'
import { areaText, summarizeArea } from '@/lib/compare'
import { formatDate } from '@/lib/date'
import { formatEok, formatPct } from '@/lib/money'
import { apartmentUrl } from '@/lib/routes'
import { regionPath } from '@/lib/selectors'
import { addToCompare, clearCompare, deleteLivingArea, MAX_COMPARE } from '@/store/ops'
import { update, useData } from '@/store/store'

export function AreaDetailPage() {
  const { areaId = '' } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const area = data.livingAreas.find((l) => l.id === areaId)
  const s = useMemo(() => (area ? summarizeArea(data, area.apartmentIds, area.representativeId) : null), [data, area])
  if (!area || !s) return <Navigate to="/areas" replace />

  const year = new Date().getFullYear()
  const members = [...s.members].sort((a, b) => (b.sale?.amountWon ?? -1) - (a.sale?.amountWon ?? -1))

  function compareAll() {
    const ids = [area!.representativeId, ...members.map((m) => m.apartment.id)].filter((x, i, arr): x is string => !!x && arr.indexOf(x) === i)
    update((d) => ids.slice(0, MAX_COMPARE).reduce((acc, id) => addToCompare(acc, { apartmentId: id, unitId: null }), clearCompare(d)))
    toast(ids.length > MAX_COMPARE ? `대표 단지부터 ${MAX_COMPARE}개를 비교 목록에 넣었습니다` : '비교 목록을 이 생활권 단지로 바꿨습니다')
    navigate('/compare')
  }

  return (
    <>
      <nav className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Link to="/areas" className="hover:underline">
          생활권
        </Link>
        <ChevronRight className="size-3" />
      </nav>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{area.name}</h1>
          {area.description && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{area.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={compareAll} disabled={members.length === 0}>
            <GitCompareArrows />
            그래프로 비교
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            수정
          </Button>
          <Button variant="outline" onClick={() => setDeleting(true)} aria-label="생활권 삭제">
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4 sm:pt-5">
          <Stat label="대표 단지" value={s.representative ? s.representative.apartment.name : '미지정'} sub={s.representative?.sale ? formatEok(s.representative.sale.amountWon) : undefined} />
          <Stat label="가격대" value={s.min && s.max ? `${formatEok(s.min.sale!.amountWon)}~${formatEok(s.max.sale!.amountWon)}` : '데이터 없음'} />
          <Stat label="중앙값" value={s.medianWon != null ? formatEok(s.medianWon) : '데이터 없음'} sub={`가격 있는 단지 ${s.priced.length}/${s.members.length}`} />
          <Stat
            label="기준일 범위"
            value={s.latestBasis ? formatDate(s.latestBasis) : '—'}
            sub={s.oldestBasis && s.oldestBasis !== s.latestBasis ? `가장 오래된 값 ${formatDate(s.oldestBasis)}` : undefined}
          />
        </CardContent>
      </Card>

      {members.length === 0 ? (
        <EmptyState title="단지가 없습니다" action={<Button onClick={() => setEditing(true)}>단지 추가</Button>} />
      ) : (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>단지 비교</CardTitle>
              <CardDescription>매매가는 각 단지 대표 면적의 최신값(실거래가 우선). 입지 메모는 단지 상세에서 수정합니다.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            <Table>
              <thead>
                <tr>
                  <Th className="pl-4 sm:pl-5">단지</Th>
                  <Th className="text-right">매매</Th>
                  <Th className="text-right">전세가율</Th>
                  <Th>면적</Th>
                  <Th className="text-right">준공</Th>
                  <Th className="text-right">세대수</Th>
                  <Th className="pr-4 sm:pr-5">교통 · 학군 · 생활 인프라</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const r = m.unit ? currentRatio(data.prices, m.unit.id) : null
                  const a = m.apartment
                  return (
                    <tr key={a.id} className="align-top hover:bg-muted/40">
                      <Td className="pl-4 sm:pl-5">
                        <div className="flex items-center gap-1 font-medium">
                          {a.id === area.representativeId && <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="대표 단지" />}
                          <Link to={apartmentUrl(a.id)} className="hover:underline">
                            {a.name}
                          </Link>
                          <SampleBadge show={a.isSample} />
                        </div>
                        <div className="text-xs text-muted-foreground">{regionPath(data, a.regionId)}</div>
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        {m.sale ? (
                          <>
                            <div className="font-semibold">{formatEok(m.sale.amountWon)}</div>
                            <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                              <PriceTypeBadge type={m.sale.priceType} />
                              {formatDate(basisDate(m.sale))}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td className="text-right tabular">{formatPct(r?.ratio ?? null, 1, false)}</Td>
                      <Td className="whitespace-nowrap text-xs">{areaText(m.unit)}</Td>
                      <Td className="text-right whitespace-nowrap text-xs">{a.builtYear ? `${a.builtYear} (${year - a.builtYear + 1}년차)` : '—'}</Td>
                      <Td className="text-right text-xs tabular">{a.households?.toLocaleString('ko-KR') ?? '—'}</Td>
                      <Td className="pr-4 text-xs sm:pr-5">
                        <LocMemo label="교통" v={a.transitMemo} />
                        <LocMemo label="학군" v={a.schoolMemo} />
                        <LocMemo label="인프라" v={a.infraMemo} />
                        {!a.transitMemo && !a.schoolMemo && !a.infraMemo && <span className="text-muted-foreground">미입력</span>}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AreaFormDialog open={editing} onClose={() => setEditing(false)} area={area} />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="생활권 삭제"
        description={`"${area.name}" 묶음만 삭제합니다. 단지와 가격 기록은 그대로 남습니다.`}
        onConfirm={() => {
          update((d) => deleteLivingArea(d, area.id), { undoLabel: `생활권 삭제: ${area.name}` })
          toast('생활권을 삭제했습니다', 'warn')
          navigate('/areas')
        }}
      />
    </>
  )
}

function LocMemo({ label, v }: { label: string; v: string | null }) {
  if (!v) return null
  return (
    <div className="max-w-64 truncate" title={v}>
      <span className="text-muted-foreground">{label}</span> {v}
    </div>
  )
}
