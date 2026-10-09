import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckSquare, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, Td, Th } from '@/components/ui/table'
import { CandidateFormDialog } from '@/components/CandidateFormDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Segmented } from '@/components/Segmented'
import { EmptyState, PageHeader, PriceTypeBadge, Warn } from '@/components/bits'
import { toast } from '@/components/toast'
import { basisDate } from '@/lib/calc'
import { areaText, gapRow, resolveItems } from '@/lib/compare'
import { formatDate } from '@/lib/date'
import { formatKoreanWon, formatPct } from '@/lib/money'
import { apartmentUrl } from '@/lib/routes'
import { regionPath } from '@/lib/selectors'
import { cn } from '@/lib/utils'
import { deleteCandidate } from '@/store/ops'
import { update, useData } from '@/store/store'
import { CANDIDATE_STATUS_LABEL, type Candidate, type CandidateStatus, type PriceRecord } from '@/store/schema'

type Filter = CandidateStatus | 'all'

export function CandidatesPage() {
  const data = useData()
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [deleting, setDeleting] = useState<Candidate | null>(null)
  const list = data.candidates.filter((c) => filter === 'all' || c.status === filter).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  return (
    <>
      <PageHeader
        title="저평가 후보 탐색 노트"
        description="가격이 상대적으로 낮아 보이는 단지를 공부 후보로 저장하고, 가설과 근거를 직접 확인해 나가는 공간입니다."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus />
            후보 추가
          </Button>
        }
      />
      <div className="mb-4">
        <Warn>
          앱은 <b>가격 차이·연식·세대수 같은 사실만</b> 계산합니다. 가격이 낮은 데는 이유가 있을 수 있어, 저평가 여부는 자동으로 판정하지 않습니다.
        </Warn>
      </div>
      <div className="mb-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          label="상태"
          options={[['all', `전체 ${data.candidates.length}`], ...(Object.entries(CANDIDATE_STATUS_LABEL) as [CandidateStatus, string][])]}
        />
      </div>

      {list.length === 0 ? (
        <EmptyState title="저장한 후보가 없습니다" action={<Button onClick={() => setAdding(true)}>후보 추가</Button>}>
          단지 상세 화면의 [저평가 후보로 저장] 버튼으로도 만들 수 있습니다.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <CandidateCard key={c.id} c={c} onEdit={() => setEditing(c)} onDelete={() => setDeleting(c)} />
          ))}
        </div>
      )}

      <CandidateFormDialog open={adding} onClose={() => setAdding(false)} />
      <CandidateFormDialog open={!!editing} onClose={() => setEditing(null)} candidate={editing ?? undefined} />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="후보 노트 삭제"
        description="이 노트만 삭제합니다. 단지와 가격 기록은 그대로 남습니다."
        onConfirm={() => {
          const id = deleting!.id
          update((d) => deleteCandidate(d, id), { undoLabel: '후보 노트 삭제' })
          toast('삭제했습니다', 'warn')
        }}
      />
    </>
  )
}

const STATUS_STYLE: Record<CandidateStatus, string> = {
  studying: 'bg-accent text-primary',
  verified: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  dropped: 'bg-muted text-muted-foreground',
}

function CandidateCard({ c, onEdit, onDelete }: { c: Candidate; onEdit: () => void; onDelete: () => void }) {
  const data = useData()
  const [target] = resolveItems(data, [c.target])
  const others = resolveItems(data, c.comparisons)
  const rows = target ? others.map((o) => gapRow(data, target, o)) : []
  if (!target) return null
  const targetPrice = rows.find((r) => r.pair.target)?.pair.target ?? null

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn(STATUS_STYLE[c.status])}>{CANDIDATE_STATUS_LABEL[c.status]}</Badge>
            <CardTitle className="text-base">
              <Link to={apartmentUrl(target.apartment.id)} className="hover:underline">
                {target.apartment.name}
              </Link>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {regionPath(data, target.apartment.regionId)} · {areaText(target.unit)}
            </span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            <span className="mr-1 text-xs font-medium text-muted-foreground">가설</span>
            {c.hypothesis}
          </p>
        </div>
        <div className="flex shrink-0">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="수정">
            <Pencil />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="삭제">
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <thead>
              <tr>
                <Th>비교 대상</Th>
                <Th className="text-right">비교 대상 매매</Th>
                <Th className="text-right">{target.apartment.name} 매매</Th>
                <Th className="text-right">가격 차이</Th>
                <Th className="text-right">연식 차이</Th>
                <Th className="text-right">세대수 차이</Th>
                <Th>주의</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.apartment.id} className="align-top">
                  <Td>
                    <Link to={apartmentUrl(r.apartment.id)} className="font-medium hover:underline">
                      {r.apartment.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{areaText(r.unit)}</div>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <PriceCell rec={r.pair.other} />
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <PriceCell rec={r.pair.target} />
                  </Td>
                  <Td className="text-right whitespace-nowrap tabular">
                    {r.diffWon == null ? (
                      '—'
                    ) : (
                      <>
                        <div className="font-semibold">{r.diffWon > 0 ? `${formatKoreanWon(r.diffWon)} 낮음` : r.diffWon < 0 ? `${formatKoreanWon(-r.diffWon)} 높음` : '같음'}</div>
                        <div className="text-[11px] text-muted-foreground">비교 대상 대비 {formatPct(r.targetVsOtherPct)}</div>
                      </>
                    )}
                  </Td>
                  <Td className="text-right whitespace-nowrap text-xs">
                    {r.builtYearDiff == null ? '—' : r.builtYearDiff === 0 ? '같은 해' : r.builtYearDiff > 0 ? `${r.builtYearDiff}년 더 새 단지` : `${-r.builtYearDiff}년 더 오래됨`}
                  </Td>
                  <Td className="text-right whitespace-nowrap text-xs tabular">{r.householdsDiff == null ? '—' : formatSigned(r.householdsDiff)}</Td>
                  <Td className="text-xs text-orange-800">
                    {r.warnings.length ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {r.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-muted-foreground">없음</span>
                    )}
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <Td colSpan={7} className="text-center text-xs text-muted-foreground">
                    비교 대상이 없습니다
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
        {!targetPrice && <p className="text-xs text-muted-foreground">대상 단지에 매매가격 기록이 없어 가격 차이를 계산할 수 없습니다.</p>}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs font-semibold">
              <CheckSquare className="size-3.5" />
              확인할 근거
            </div>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {c.evidenceToCheck
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean)
                .map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
            </ul>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <Diff label="입지" v={c.locationDiff} />
            <Diff label="연식" v={c.ageDiff} />
            <Diff label="면적" v={c.areaDiff} />
            <Diff label="거래량" v={c.volumeDiff} />
            <Diff label="결론" v={c.conclusion} />
          </dl>
        </div>
        <p className="text-[11px] text-muted-foreground">
          작성 {formatDate(c.createdAt.slice(0, 10))} · 수정 {formatDate(c.updatedAt.slice(0, 10))}
        </p>
      </CardContent>
    </Card>
  )
}

function PriceCell({ rec }: { rec: PriceRecord | null }) {
  if (!rec) return <span className="text-muted-foreground">데이터 없음</span>
  return (
    <>
      <div className="font-semibold">{formatKoreanWon(rec.amountWon)}</div>
      <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        <PriceTypeBadge type={rec.priceType} />
        {formatDate(basisDate(rec))}
      </div>
    </>
  )
}

function Diff({ label, v }: { label: string; v: string | null }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('whitespace-pre-wrap', !v && 'text-xs text-muted-foreground')}>{v ?? '미기록'}</dd>
    </>
  )
}

function formatSigned(n: number) {
  return `${n > 0 ? '+' : ''}${n.toLocaleString('ko-KR')}`
}

