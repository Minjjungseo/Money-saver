import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, BookOpen, FlaskConical, PenLine, Plus, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, Textarea } from '@/components/ui/input'
import { ChangeText, EmptyState, PageHeader, PriceTypeBadge, SampleBadge, SourceLink, Stat, Warn } from '@/components/bits'
import { toast } from '@/components/toast'
import { addSampleData } from '@/data/sample'
import { daysBetween, formatDate, todayISO } from '@/lib/date'
import { formatKoreanWon } from '@/lib/money'
import { apartmentUrl, regionUrl } from '@/lib/routes'
import { describePrice, lastUpdated, recentPrices, regionPath, summarize, unitLabel } from '@/lib/selectors'
import { setTodayMemo, setWeeklyFocus } from '@/store/ops'
import { update, useData } from '@/store/store'
import { PRICE_KIND_LABEL } from '@/store/schema'

/** 마지막 조사일이 이보다 오래되면 경고 */
const STALE_DAYS = 90

export function HomePage() {
  const data = useData()
  const today = todayISO()

  const summaries = useMemo(() => data.apartments.map((a) => summarize(data, a)), [data])
  const trackedRegions = new Set(data.apartments.map((a) => a.regionId)).size
  const movers = summaries.filter((s) => s.saleChange && s.saleChange.diffWon !== 0)
  const ups = movers.filter((s) => s.saleChange!.diffWon > 0).sort((a, b) => b.saleChange!.ratePct - a.saleChange!.ratePct).slice(0, 5)
  const downs = movers.filter((s) => s.saleChange!.diffWon < 0).sort((a, b) => a.saleChange!.ratePct - b.saleChange!.ratePct).slice(0, 5)
  const recent = recentPrices(data, 6)
  const updated = lastUpdated(data)

  return (
    <>
      <PageHeader
        title="전국 시장 현황"
        description="직접 조사·검증해 입력한 가격만 표시합니다. 자동으로 업데이트되지 않습니다."
        actions={
          <Link to="/input">
            <Button>
              <PenLine />
              시세 입력
            </Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-4 sm:pt-5">
          <Stat label="마지막 데이터 업데이트" value={updated ? formatDate(updated) : '데이터 없음'} sub="가장 최근 조사일" />
          <Stat label="추적 중인 지역" value={trackedRegions ? `${trackedRegions}곳` : '데이터 없음'} />
          <Stat label="추적 중인 아파트" value={data.apartments.length ? `${data.apartments.length}개 단지` : '데이터 없음'} />
          <Stat label="가격 기록" value={data.prices.length ? `${data.prices.length}건` : '데이터 없음'} />
        </CardContent>
      </Card>

      {updated && daysBetween(updated, today) > STALE_DAYS && (
        <div className="mb-4">
          <Warn>
            가장 최근 조사일이 {formatDate(updated)}로 {daysBetween(updated, today).toLocaleString('ko-KR')}일 전입니다. 아래 상승·하락은 그 시점 기록끼리의 비교이며 현재 시장 상황이 아닙니다.
          </Warn>
        </div>
      )}

      {data.apartments.length === 0 && (
        <div className="mb-4">
          <EmptyState
            title="아직 추적 중인 단지가 없습니다"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/input">
                  <Button>
                    <Plus />첫 단지·시세 입력
                  </Button>
                </Link>
                <Link to="/backup">
                  <Button variant="outline">CSV/백업 가져오기</Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => {
                    update((d) => addSampleData(d, today))
                    toast('예시 데이터를 넣었습니다 (실제 시세 아님)')
                  }}
                >
                  <FlaskConical />
                  화면 테스트용 예시 데이터 넣기
                </Button>
              </div>
            }
          >
            기존 Google Sheets 자료는 CSV로 내려받아 [백업] 화면에서 가져올 수 있습니다.
          </EmptyState>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <MoversCard title="최근 상승" icon={<ArrowUpRight className="size-4 text-up" />} items={ups} data={data} />
        <MoversCard title="최근 하락" icon={<ArrowDownRight className="size-4 text-down" />} items={downs} data={data} />

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>최근 입력한 가격 기록</CardTitle>
              <CardDescription>입력한 순서대로</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">데이터 없음</p>
            ) : (
              <ul className="divide-y">
                {recent.map((p) => {
                  const { apartment, unit } = describePrice(data, p)
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                      <Link to={apartment ? apartmentUrl(apartment.id) : '#'} className="font-medium hover:underline">
                        {apartment?.name ?? '(삭제된 단지)'}
                      </Link>
                      <span className="text-xs text-muted-foreground">{unitLabel(unit)}</span>
                      <span className="text-xs">{PRICE_KIND_LABEL[p.kind]}</span>
                      <PriceTypeBadge type={p.priceType} />
                      <SampleBadge show={p.isSample} />
                      <span className="ml-auto font-semibold tabular">{formatKoreanWon(p.amountWon)}</span>
                      <span className="w-full text-xs text-muted-foreground sm:w-auto">
                        기준일 {formatDate(p.dealDate ?? p.surveyDate)} · <SourceLink record={p} />
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <WeeklyFocusCard />
        <TodayMemoCard />
      </div>
    </>
  )
}

function MoversCard({ title, icon, items, data }: { title: string; icon: ReactNode; items: ReturnType<typeof summarize>[]; data: ReturnType<typeof useData> }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>매매가 · 직전 기록 대비 (같은 면적·같은 가격 유형)</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">데이터 없음</p>
        ) : (
          <ul className="divide-y">
            {items.map((s) => (
              <li key={s.apartment.id} className="flex items-center gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <Link to={apartmentUrl(s.apartment.id)} className="font-medium hover:underline">
                    {s.apartment.name}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {regionPath(data, s.apartment.regionId)} · {unitLabel(s.unit)}
                  </div>
                </div>
                <SampleBadge show={s.apartment.isSample} />
                <ChangeText change={s.saleChange} className="ml-auto text-right" />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function WeeklyFocusCard() {
  const data = useData()
  const [pick, setPick] = useState('')
  const ids = data.settings.weeklyFocusRegionIds
  const options = data.regions.filter((r) => !ids.includes(r.id)).sort((a, b) => a.id.localeCompare(b.id, 'ko'))
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>이번 주 공부할 지역</CardTitle>
          <CardDescription>직접 골라 두는 목록입니다</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-2">
          {ids.length === 0 && <span className="text-sm text-muted-foreground">아직 정하지 않았습니다</span>}
          {ids.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pl-3 pr-1 text-sm text-primary">
              <Link to={regionUrl(id)} className="hover:underline">
                {regionPath(data, id) || id}
              </Link>
              <button
                aria-label="제거"
                className="rounded-full p-0.5 hover:bg-white"
                onClick={() => update((d) => setWeeklyFocus(d, ids.filter((x) => x !== id)))}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="지역 선택">
            <option value="">지역 선택</option>
            {options.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.replace(/\//g, ' ')}
              </option>
            ))}
          </Select>
          <Button
            variant="secondary"
            disabled={!pick}
            onClick={() => {
              update((d) => setWeeklyFocus(d, [...ids, pick]))
              setPick('')
            }}
          >
            추가
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TodayMemoCard() {
  const data = useData()
  const today = todayISO()
  const memo = data.settings.todayMemo
  const isToday = memo?.date === today
  const [text, setText] = useState(isToday ? memo!.text : '')
  const dirty = text !== (isToday ? memo!.text : '')
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <BookOpen className="size-4 text-primary" />
            오늘의 공부 메모
          </CardTitle>
          <CardDescription>{formatDate(today)}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {memo && !isToday && (
          <div className="mb-3 rounded-lg bg-muted px-3 py-2 text-xs">
            <div className="mb-1 text-muted-foreground">지난 메모 · {formatDate(memo.date)}</div>
            <p className="whitespace-pre-wrap">{memo.text}</p>
          </div>
        )}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="오늘 읽은 뉴스, 확인할 질문, 지역 비교 메모…" className="min-h-24" />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() => {
              update((d) => setTodayMemo(d, today, text))
              toast('메모를 저장했습니다')
            }}
          >
            저장
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

