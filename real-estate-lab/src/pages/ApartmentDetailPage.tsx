import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ChevronRight, GitCompareArrows, Lightbulb, MapPin, Pencil, PenLine, Star, Trash2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Table, Td, Th } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ApartmentFormDialog } from '@/components/ApartmentFormDialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PriceEditDialog } from '@/components/PriceEditDialog'
import { UnitEditDialog } from '@/components/UnitEditDialog'
import { CandidateFormDialog } from '@/components/CandidateFormDialog'
import { LocationDialog } from '@/components/LocationDialog'
import { PriceHistoryChart, RatioChart } from '@/components/PriceCharts'
import { ChangeText, EmptyState, PriceTypeBadge, SampleBadge, SourceLink, Warn } from '@/components/bits'
import { toast } from '@/components/toast'
import {
  RATIO_DATE_GAP_WARN_DAYS, basisDate, changeFromPrevious, currentRatio, diff, extremes, periodChange, seriesOf, sortByBasis,
} from '@/lib/calc'
import { formatDate } from '@/lib/date'
import { formatKoreanWon, formatPct } from '@/lib/money'
import { inputUrl, regionUrl } from '@/lib/routes'
import { regionPath, unitChip, unitLabel, unitsOf } from '@/lib/selectors'
import { cn } from '@/lib/utils'
import { addToCompare, deleteApartment, deletePrice, MAX_COMPARE, updateApartment } from '@/store/ops'
import { update, useData } from '@/store/store'
import { LOCATION_SOURCE_LABEL, PRICE_KIND_LABEL, PRICE_TYPE_LABEL, type ApartmentUnit, type PriceKind, type PriceRecord, type PriceType } from '@/store/schema'

const KINDS: PriceKind[] = ['sale', 'jeonse']
const TYPES: PriceType[] = ['actual', 'asking', 'other']

export function ApartmentDetailPage() {
  const { apartmentId = '' } = useParams()
  const data = useData()
  const navigate = useNavigate()
  const apt = data.apartments.find((a) => a.id === apartmentId)
  const units = useMemo(() => (apt ? unitsOf(data, apt.id) : []), [data, apt])
  const [unitPick, setUnitPick] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editRec, setEditRec] = useState<PriceRecord | null>(null)
  const [delRec, setDelRec] = useState<PriceRecord | null>(null)
  const [editUnit, setEditUnit] = useState<ApartmentUnit | null>(null)
  const [candidateOpen, setCandidateOpen] = useState(false)
  const [locating, setLocating] = useState(false)

  const unit = units.find((u) => u.id === unitPick) ?? units.find((u) => data.prices.some((p) => p.unitId === u.id)) ?? units[0] ?? null
  const prices = useMemo(() => (unit ? data.prices.filter((p) => p.unitId === unit.id) : []), [data.prices, unit])

  if (!apt) return <Navigate to="/apartments" replace />

  const inCompare = data.settings.compare.some((x) => x.apartmentId === apt.id)
  const myAreas = data.livingAreas.filter((l) => l.apartmentIds.includes(apt.id))
  const myCandidates = data.candidates.filter((c) => c.target.apartmentId === apt.id).length
  const allAptPrices = data.prices.filter((p) => units.some((u) => u.id === p.unitId))
  const now = unit ? currentRatio(prices, unit.id) : null
  const presentSeries = KINDS.flatMap((k) => TYPES.map((t) => ({ kind: k, type: t, list: unit ? seriesOf(prices, unit.id, k, t) : [] }))).filter((s) => s.list.length > 0)
  const crumbs = apt.regionId.split('/').map((_, i, arr) => arr.slice(0, i + 1).join('/'))
  const age = apt.builtYear ? new Date().getFullYear() - apt.builtYear + 1 : null

  return (
    <>
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <Link to="/apartments" className="hover:underline">
          단지
        </Link>
        {crumbs.map((c) => (
          <span key={c} className="flex items-center gap-1">
            <ChevronRight className="size-3" />
            <Link to={regionUrl(c)} className="hover:underline">
              {c.split('/').at(-1)}
            </Link>
          </span>
        ))}
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {apt.isLandmark && <Star className="size-5 fill-amber-400 text-amber-400" aria-label="대표 단지" />}
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{apt.name}</h1>
            <SampleBadge show={apt.isSample} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{regionPath(data, apt.regionId)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={inputUrl({ apt: apt.id, unit: unit?.id })}>
            <Button>
              <PenLine />
              시세 입력
            </Button>
          </Link>
          <Button
            variant="secondary"
            disabled={inCompare || data.settings.compare.length >= MAX_COMPARE}
            onClick={() => {
              update((d) => addToCompare(d, { apartmentId: apt.id, unitId: unit?.id ?? null }))
              toast('비교 목록에 추가했습니다')
            }}
          >
            <GitCompareArrows />
            {inCompare ? '비교 목록에 있음' : '비교에 추가'}
          </Button>
          <Button variant="outline" onClick={() => setCandidateOpen(true)}>
            <Lightbulb />
            저평가 후보로 저장
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil />
            수정
          </Button>
          <Button variant="outline" onClick={() => setDeleting(true)} aria-label="단지 삭제">
            <Trash2 className="text-destructive" />
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 text-sm sm:grid-cols-4 sm:pt-5">
          <Info label="주소" value={apt.address} className="col-span-2" />
          <Info label="준공연도" value={apt.builtYear ? `${apt.builtYear}년 (${age}년차)` : null} />
          <Info label="세대수" value={apt.households ? `${apt.households.toLocaleString('ko-KR')}세대` : null} />
          <Info label="교통" value={apt.transitMemo} className="col-span-2 sm:col-span-4 lg:col-span-2" />
          <Info label="학군" value={apt.schoolMemo} />
          <Info label="생활 인프라" value={apt.infraMemo} />
          <div className="col-span-2 sm:col-span-4">
            <div className="text-xs text-muted-foreground">지도 위치</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {apt.location ? (
                <span>
                  {apt.location.matchedName ?? '직접 입력'}
                  <span className="ml-1 text-xs text-muted-foreground">({LOCATION_SOURCE_LABEL[apt.location.source]})</span>
                </span>
              ) : (
                <span className="text-muted-foreground">미확인 — 지도에 표시되지 않습니다</span>
              )}
              <Button size="sm" variant="ghost" onClick={() => setLocating(true)}>
                <MapPin />
                {apt.location ? '위치 수정' : '위치 정하기'}
              </Button>
              {apt.location && (
                <Link to="/map" className="text-xs text-primary underline">
                  지도에서 보기
                </Link>
              )}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-4">
            <div className="text-xs text-muted-foreground">생활권</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {myAreas.length === 0 && <span className="text-muted-foreground">없음 — [생활권] 화면에서 묶을 수 있어요</span>}
              {myAreas.map((l) => (
                <Link key={l.id} to={`/areas/${l.id}`} className="rounded-md bg-accent px-2 py-0.5 text-xs text-primary hover:underline">
                  {l.name}
                </Link>
              ))}
              {myCandidates > 0 && (
                <Link to="/candidates" className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200 hover:underline">
                  저평가 후보 노트 {myCandidates}개
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {units.length === 0 ? (
        <EmptyState title="등록된 면적과 가격 기록이 없습니다" action={<Link to={inputUrl({ apt: apt.id })}><Button>첫 시세 입력</Button></Link>}>
          시세 입력 화면에서 전용면적과 함께 가격을 입력하면 이곳에 추이가 나타납니다.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-muted-foreground">면적</span>
            {units.map((u) => (
              <button
                key={u.id}
                onClick={() => setUnitPick(u.id)}
                className={cn('rounded-full border px-3 py-1 text-sm', unit?.id === u.id ? 'border-primary bg-primary text-white' : 'bg-card hover:border-primary')}
              >
                {unitChip(u)}
              </button>
            ))}
            {unit && (
              <Button size="sm" variant="ghost" onClick={() => setEditUnit(unit)}>
                <Pencil />
                면적 정보
              </Button>
            )}
            <span className="ml-1 text-xs text-muted-foreground">같은 단지·같은 면적끼리만 비교합니다 · 대표 가격은 최신 실거래가 우선</span>
          </div>
          {unit && unit.exclusiveArea == null && (
            <div className="mb-4">
              <Warn>전용면적이 확인되지 않은 면적입니다(원본: {unitChip(unit)}). [면적 정보]에서 확인한 전용면적을 입력해 두면 새 실거래가와 같은 면적으로 비교할 수 있어요.</Warn>
            </div>
          )}

          {/* 현재 요약 */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <LatestCard title="매매" r={now?.sale ?? null} all={prices} />
            <LatestCard title="전세" r={now?.jeonse ?? null} all={prices} />
            <Card>
              <CardContent className="pt-4">
                <div className="text-xs text-muted-foreground">전세가율</div>
                <div className="mt-1 text-2xl font-bold tabular">{now?.ratio != null ? formatPct(now.ratio, 1, false) : '데이터 없음'}</div>
                {now?.gapDays != null && (
                  <div className="mt-2">
                    {now.gapDays > RATIO_DATE_GAP_WARN_DAYS ? (
                      <Warn>매매·전세 기준일이 {now.gapDays}일 차이납니다. 같은 시점 비교가 아닙니다.</Warn>
                    ) : (
                      <p className="text-xs text-muted-foreground">기준일 차이 {now.gapDays}일</p>
                    )}
                  </div>
                )}
                {now?.sale && now.jeonse && now.sale.priceType !== now.jeonse.priceType && (
                  <div className="mt-2">
                    <Warn>
                      매매는 {PRICE_TYPE_LABEL[now.sale.priceType]}, 전세는 {PRICE_TYPE_LABEL[now.jeonse.priceType]} 기준입니다.
                    </Warn>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>매매·전세 가격 추이</CardTitle>
                  <CardDescription>실선 = 실거래가 · 긴 점선 = 호가 · 짧은 점선 = 기타. 유형이 다르면 다른 선입니다.</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <PriceHistoryChart prices={prices} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>전세가율 추이</CardTitle>
                  <CardDescription>함께 입력한 매매·전세 쌍 기준</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <RatioChart prices={prices} unitId={unit!.id} />
              </CardContent>
            </Card>
          </div>

          {/* 기간 변화 + 최고·최저 */}
          <Card className="mb-4">
            <CardHeader>
              <div>
                <CardTitle>현재 가격과 과거 비교</CardTitle>
                <CardDescription>
                  같은 시계열(종류·유형) 안에서만 계산합니다. N개월 전 ±45일 안에 기록이 없으면 비워 둡니다.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              <Table>
                <thead>
                  <tr>
                    <Th className="pl-4 sm:pl-5">시계열</Th>
                    <Th className="text-right">최신</Th>
                    <Th className="text-right">직전 대비</Th>
                    <Th className="text-right">3개월</Th>
                    <Th className="text-right">6개월</Th>
                    <Th className="text-right">12개월</Th>
                    <Th className="text-right">기록 최고</Th>
                    <Th className="pr-4 text-right sm:pr-5">기록 최저</Th>
                  </tr>
                </thead>
                <tbody>
                  {presentSeries.map(({ kind, type, list }) => {
                    const latest = list.at(-1)!
                    const ex = extremes(list)!
                    return (
                      <tr key={`${kind}${type}`}>
                        <Td className="pl-4 whitespace-nowrap sm:pl-5">
                          {PRICE_KIND_LABEL[kind]} <PriceTypeBadge type={type} />
                        </Td>
                        <Td className="text-right whitespace-nowrap font-semibold">{formatKoreanWon(latest.amountWon)}</Td>
                        <Td className="text-right whitespace-nowrap"><ChangeText change={changeFromPrevious(list, latest)} showAmount={false} /></Td>
                        {[3, 6, 12].map((m) => (
                          <Td key={m} className="text-right whitespace-nowrap"><ChangeText change={periodChange(list, m)} showAmount={false} /></Td>
                        ))}
                        <Td className="text-right whitespace-nowrap">
                          <div>{formatKoreanWon(ex.max.amountWon)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(basisDate(ex.max))} · 현재 {formatPct(diff(ex.max, latest).ratePct)}
                          </div>
                        </Td>
                        <Td className="pr-4 text-right whitespace-nowrap sm:pr-5">
                          <div>{formatKoreanWon(ex.min.amountWon)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(basisDate(ex.min))} · 현재 {formatPct(diff(ex.min, latest).ratePct)}
                          </div>
                        </Td>
                      </tr>
                    )
                  })}
                  {presentSeries.length === 0 && (
                    <tr>
                      <Td colSpan={8} className="text-center text-muted-foreground">데이터 없음</Td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          {/* 기록 표 */}
          <Card className="mb-4">
            <CardHeader>
              <div>
                <CardTitle>가격 기록 ({unitLabel(unit)})</CardTitle>
                <CardDescription>최근 기준일 순 · 수정·삭제 가능</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-0 sm:px-0">
              <Table>
                <thead>
                  <tr>
                    <Th className="pl-4 sm:pl-5">기준일</Th>
                    <Th>종류</Th>
                    <Th className="text-right">금액</Th>
                    <Th className="text-right">직전 대비</Th>
                    <Th>조사일</Th>
                    <Th>출처</Th>
                    <Th>메모</Th>
                    <Th className="pr-4 sm:pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {sortByBasis(prices).reverse().map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <Td className="pl-4 whitespace-nowrap sm:pl-5">
                        {formatDate(basisDate(p))}
                        {!p.dealDate && <div className="text-[11px] text-muted-foreground">거래일 미입력</div>}
                      </Td>
                      <Td className="whitespace-nowrap">
                        <span className="mr-1">{PRICE_KIND_LABEL[p.kind]}</span>
                        <PriceTypeBadge type={p.priceType} />
                        {p.legacy && <Badge variant="warn" className="ml-1">과거자료</Badge>}
                        {p.isSample && <span className="ml-1"><SampleBadge /></span>}
                      </Td>
                      <Td className="text-right whitespace-nowrap font-semibold">{formatKoreanWon(p.amountWon)}</Td>
                      <Td className="text-right whitespace-nowrap"><ChangeText change={changeFromPrevious(prices, p)} /></Td>
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(p.surveyDate)}</Td>
                      <Td className="whitespace-nowrap"><SourceLink record={p} /></Td>
                      <Td className="max-w-48 truncate text-xs text-muted-foreground" title={p.memo ?? ''}>{p.memo ?? ''}</Td>
                      <Td className="pr-4 whitespace-nowrap text-right sm:pr-5">
                        <Button size="icon" variant="ghost" onClick={() => setEditRec(p)} aria-label="수정"><Pencil /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setDelRec(p)} aria-label="삭제"><Trash2 className="text-destructive" /></Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <MemoCard aptId={apt.id} memo={apt.memo} />

      <ApartmentFormDialog open={editing} onClose={() => setEditing(false)} apartment={apt} />
      <PriceEditDialog record={editRec} onClose={() => setEditRec(null)} />
      <UnitEditDialog unit={editUnit} onClose={() => setEditUnit(null)} />
      <LocationDialog apartment={locating ? apt : null} onClose={() => setLocating(false)} />
      <CandidateFormDialog open={candidateOpen} onClose={() => setCandidateOpen(false)} defaultTarget={{ apartmentId: apt.id, unitId: unit?.id ?? null }} />
      <ConfirmDialog
        open={!!delRec}
        onClose={() => setDelRec(null)}
        title="가격 기록 삭제"
        description={delRec && `${PRICE_KIND_LABEL[delRec.kind]} ${formatKoreanWon(delRec.amountWon)} (기준일 ${formatDate(basisDate(delRec))}) 기록을 삭제할까요? 삭제 직후에는 [백업] 화면에서 되돌릴 수 있습니다.`}
        onConfirm={() => {
          const id = delRec!.id
          update((d) => deletePrice(d, id), { undoLabel: '가격 기록 삭제' })
          toast('삭제했습니다. 백업 화면에서 되돌릴 수 있어요', 'warn')
        }}
      />
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="단지 삭제"
        description={`"${apt.name}"과(와) 면적 ${units.length}개, 가격 기록 ${allAptPrices.length}건이 모두 삭제됩니다. 삭제 직후에는 [백업] 화면에서 되돌릴 수 있습니다.`}
        typeToConfirm={allAptPrices.length > 0 ? apt.name : undefined}
        onConfirm={() => {
          update((d) => deleteApartment(d, apt.id), { undoLabel: `단지 삭제: ${apt.name}` })
          toast('단지를 삭제했습니다', 'warn')
          navigate('/apartments')
        }}
      />
    </>
  )
}

function Info({ label, value, className }: { label: string; value: string | null; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5', !value && 'text-muted-foreground')}>{value ?? '미입력'}</div>
    </div>
  )
}

function LatestCard({ title, r, all }: { title: string; r: PriceRecord | null; all: PriceRecord[] }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {title}
          {r && <PriceTypeBadge type={r.priceType} />}
        </div>
        <div className="mt-1 text-2xl font-bold tabular">{r ? formatKoreanWon(r.amountWon) : '데이터 없음'}</div>
        {r && (
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <div>
              직전 대비 <ChangeText change={changeFromPrevious(all, r)} />
            </div>
            <div>
              기준일 {formatDate(basisDate(r))} · 조사일 {formatDate(r.surveyDate)}
            </div>
            <div>
              <SourceLink record={r} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MemoCard({ aptId, memo }: { aptId: string; memo: string | null }) {
  const [text, setText] = useState(memo ?? '')
  const dirty = text !== (memo ?? '')
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>개인 공부 메모</CardTitle>
          <CardDescription>입지·학군·교통·비교 포인트, 복기 내용</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-28" placeholder="이 단지를 왜 추적하는지, 무엇을 확인할지 적어 두세요" />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => {
              update((d) => updateApartment(d, aptId, { memo: text.trim() || null }))
              toast('메모를 저장했습니다')
            }}
          >
            메모 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
