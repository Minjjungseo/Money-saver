import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, GitCompareArrows, KeyRound, MapPin, MapPinOff, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { KakaoMap, type MapPoint } from '@/components/KakaoMap'
import { LocationDialog } from '@/components/LocationDialog'
import { BulkLocateDialog } from '@/components/BulkLocateDialog'
import { PriceHistoryChart } from '@/components/PriceCharts'
import { EmptyState, PageHeader, PriceTypeBadge, SampleBadge, Warn } from '@/components/bits'
import { toast } from '@/components/toast'
import { basisDate, currentRatio } from '@/lib/calc'
import { areaText } from '@/lib/compare'
import { formatDate } from '@/lib/date'
import { convexHull, NO_PRICE_STYLE, PRICE_STEPS, priceStep } from '@/lib/geo'
import { getKakaoKey, KAKAO_SETUP_HINT, setKakaoKey } from '@/lib/kakao'
import { formatEok, formatKoreanWon, formatPct } from '@/lib/money'
import { apartmentUrl } from '@/lib/routes'
import { regionPath, summarize } from '@/lib/selectors'
import { cn } from '@/lib/utils'
import { addToCompare, MAX_COMPARE, removeFromCompare } from '@/store/ops'
import { update, useData } from '@/store/store'
import { LOCATION_SOURCE_LABEL, type Apartment, type PriceRecord } from '@/store/schema'

export function MapPage() {
  const data = useData()
  const [key, setKey] = useState(getKakaoKey())
  const [mapError, setMapError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [bands, setBands] = useState<string[]>([]) // 선택한 가격 구간 라벨 (비면 전체)
  const [areaId, setAreaId] = useState('')
  const [sido, setSido] = useState('')
  const [locating, setLocating] = useState<Apartment | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const summaries = useMemo(() => data.apartments.map((a) => summarize(data, a)), [data])
  const area = data.livingAreas.find((l) => l.id === areaId) ?? null
  const inScope = (a: Apartment) => !sido || a.regionId.split('/')[0] === sido
  const located = summaries.filter((s) => s.apartment.location && inScope(s.apartment))
  const unlocated = summaries.filter((s) => !s.apartment.location && inScope(s.apartment)).map((s) => s.apartment)
  const compareIds = new Set(data.settings.compare.map((c) => c.apartmentId))

  const points: MapPoint[] = useMemo(
    () =>
      located.map((s) => {
        const won = s.sale?.amountWon ?? null
        const st = priceStep(won)
        const bandOk = bands.length === 0 || bands.includes(st.label)
        const areaOk = !area || area.apartmentIds.includes(s.apartment.id)
        return {
          id: s.apartment.id,
          lat: s.apartment.location!.lat,
          lng: s.apartment.location!.lng,
          title: s.apartment.name,
          sub: won != null ? formatEok(won, 1) : '가격 없음',
          bg: st.color,
          fg: st.text,
          dimmed: !(bandOk && areaOk),
          selected: s.apartment.id === selectedId,
          compared: compareIds.has(s.apartment.id),
        }
      }),
    [located, bands, area, selectedId, data.settings.compare], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const hull = useMemo(
    () => (area ? convexHull(located.filter((s) => area.apartmentIds.includes(s.apartment.id)).map((s) => s.apartment.location!)) : []),
    [area, located],
  )
  const fitKey = `${sido}|${areaId}|${bands.join(',')}|${located.length}`
  const selected = summaries.find((s) => s.apartment.id === selectedId) ?? null
  const sidos = data.regions.filter((r) => r.type === 'sido' && data.apartments.some((a) => a.regionId.split('/')[0] === r.id))
  const toggleBand = (label: string) => setBands((b) => (b.includes(label) ? b.filter((x) => x !== label) : [...b, label]))

  if (!key) return <KeySetup onSaved={(k) => { setKakaoKey(k); setKey(k); setMapError('') }} />

  return (
    <>
      <PageHeader
        title="지도"
        description="위치를 확인해 둔 단지만 표시합니다. 라벨 색은 대표 면적의 최신 매매가(실거래가 우선) 구간입니다."
        actions={
          <Button variant="ghost" size="sm" onClick={() => { setKakaoKey(''); setKey('') }}>
            <KeyRound />
            키 변경
          </Button>
        }
      />

      {/* 필터 */}
      <Card className="mb-4">
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={sido} onChange={(e) => setSido(e.target.value)} className="w-auto" aria-label="시도">
              <option value="">전체 시·도</option>
              {sidos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="w-auto" aria-label="생활권">
              <option value="">생활권 강조 없음</option>
              {data.livingAreas.map((l) => (
                <option key={l.id} value={l.id}>
                  생활권: {l.name}
                </option>
              ))}
            </Select>
            <span className="ml-auto text-xs text-muted-foreground">
              지도 표시 {located.length}개 · 위치 미확인 {unlocated.length}개
            </span>
            {unlocated.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
                <MapPinOff />
                위치 찾기
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="가격 구간">
            <span className="mr-1 text-xs text-muted-foreground">가격 구간</span>
            {[...PRICE_STEPS, NO_PRICE_STYLE].map((s) => {
              const on = bands.includes(s.label)
              return (
                <button
                  key={s.label}
                  onClick={() => toggleBand(s.label)}
                  aria-pressed={on}
                  className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs', on ? 'border-primary bg-accent font-medium text-primary' : 'bg-card')}
                >
                  <span className="inline-block size-3 rounded-sm border border-slate-300" style={{ background: s.color }} />
                  {s.label}
                </button>
              )
            })}
            {bands.length > 0 && (
              <button className="text-xs text-muted-foreground underline" onClick={() => setBands([])}>
                전체 보기
              </button>
            )}
          </div>
          {area && hull.length === 0 && <p className="text-xs text-muted-foreground">이 생활권은 위치가 확인된 단지가 3개 미만이라 외곽선을 그리지 않습니다.</p>}
          {area && hull.length > 0 && <p className="text-xs text-muted-foreground">점선 영역은 생활권 소속 단지 위치를 이은 모양이며, 실제 생활권 경계가 아닙니다.</p>}
        </CardContent>
      </Card>

      {mapError && (
        <div className="mb-4">
          <Warn>
            {mapError}
            <button className="ml-2 underline" onClick={() => { setKakaoKey(''); setKey('') }}>
              키 다시 입력
            </button>
          </Warn>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          {located.length === 0 && !mapError ? (
            <EmptyState
              title="위치가 확인된 단지가 없습니다"
              action={unlocated.length > 0 && <Button onClick={() => setBulkOpen(true)}>위치 찾기 시작</Button>}
            >
              위치를 모르는 단지를 임의 좌표로 그리지 않습니다. 카카오 장소 검색 결과에서 맞는 곳을 골라 위치를 정해 주세요.
            </EmptyState>
          ) : (
            !mapError && <KakaoMap points={points} hull={hull} fitKey={fitKey} onSelect={setSelectedId} onError={setMapError} />
          )}
        </div>

        {/* 선택한 단지 */}
        <div className="space-y-4">
          {selected ? (
            <Card>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-1.5 text-base">
                    <Link to={apartmentUrl(selected.apartment.id)} className="truncate hover:underline">
                      {selected.apartment.name}
                    </Link>
                    <SampleBadge show={selected.apartment.isSample} />
                  </CardTitle>
                  <CardDescription>
                    {regionPath(data, selected.apartment.regionId)} · {areaText(selected.unit)}
                    {selected.apartment.builtYear ? ` · ${selected.apartment.builtYear}년` : ''}
                    {selected.apartment.households ? ` · ${selected.apartment.households.toLocaleString('ko-KR')}세대` : ''}
                  </CardDescription>
                </div>
                <button className="rounded p-1 text-muted-foreground hover:bg-muted" aria-label="닫기" onClick={() => setSelectedId(null)}>
                  <X className="size-4" />
                </button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <PriceBox label="매매" rec={selected.sale} />
                  <PriceBox label="전세" rec={selected.jeonse} />
                  <div>
                    <div className="text-xs text-muted-foreground">전세가율</div>
                    <div className="font-semibold tabular">{formatPct(selected.unit ? currentRatio(data.prices, selected.unit.id).ratio : null, 1, false)}</div>
                  </div>
                </div>
                {selected.unit && (
                  <PriceHistoryChart prices={data.prices.filter((p) => p.unitId === selected.unit!.id)} height={180} />
                )}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">교통</dt>
                  <dd>{selected.apartment.transitMemo ?? '미입력'}</dd>
                  <dt className="text-muted-foreground">학군</dt>
                  <dd>{selected.apartment.schoolMemo ?? '미입력'}</dd>
                  <dt className="text-muted-foreground">인프라</dt>
                  <dd>{selected.apartment.infraMemo ?? '미입력'}</dd>
                  <dt className="text-muted-foreground">위치</dt>
                  <dd>
                    {selected.apartment.location?.matchedName ?? '직접 입력'} ({selected.apartment.location ? LOCATION_SOURCE_LABEL[selected.apartment.location.source] : ''})
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={compareIds.has(selected.apartment.id) ? 'outline' : 'secondary'}
                    disabled={!compareIds.has(selected.apartment.id) && data.settings.compare.length >= MAX_COMPARE}
                    onClick={() => {
                      const id = selected.apartment.id
                      if (compareIds.has(id)) update((d) => removeFromCompare(d, id))
                      else {
                        update((d) => addToCompare(d, { apartmentId: id, unitId: null }))
                        toast('비교 목록에 추가했습니다')
                      }
                    }}
                  >
                    <GitCompareArrows />
                    {compareIds.has(selected.apartment.id) ? '비교에서 빼기' : '비교에 추가'}
                  </Button>
                  <Link to={apartmentUrl(selected.apartment.id)}>
                    <Button size="sm" variant="outline">
                      상세 보기
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" onClick={() => setLocating(selected.apartment)}>
                    <MapPin />
                    위치 수정
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 text-sm text-muted-foreground">지도에서 단지 라벨을 누르면 가격·이력·입지 메모가 여기에 나옵니다.</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>비교 목록 ({data.settings.compare.length}/{MAX_COMPARE})</CardTitle>
                <CardDescription>빨간 테두리 라벨이 비교 목록에 있는 단지입니다.</CardDescription>
              </div>
              {data.settings.compare.length > 0 && (
                <Link to="/compare">
                  <Button size="sm">그래프로 비교</Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {data.settings.compare.length === 0 ? (
                <p className="text-xs text-muted-foreground">아직 없습니다.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {data.settings.compare.map((c) => {
                    const a = data.apartments.find((x) => x.id === c.apartmentId)
                    if (!a) return null
                    return (
                      <li key={a.id} className="flex items-center gap-1 rounded-full border bg-card py-0.5 pl-2.5 pr-1 text-xs">
                        <button onClick={() => setSelectedId(a.id)} className="hover:underline">
                          {a.name}
                        </button>
                        <button aria-label="빼기" className="rounded-full p-0.5 hover:bg-muted" onClick={() => update((d) => removeFromCompare(d, a.id))}>
                          <X className="size-3" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <LocationDialog apartment={locating} onClose={() => setLocating(null)} />
      <BulkLocateDialog open={bulkOpen} onClose={() => setBulkOpen(false)} apartments={unlocated} onPickOne={(a) => setLocating(a)} />
    </>
  )
}

function PriceBox({ label, rec }: { label: string; rec: PriceRecord | null }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {label} {rec && <PriceTypeBadge type={rec.priceType} />}
      </div>
      <div className="font-semibold tabular" title={rec ? formatKoreanWon(rec.amountWon) : undefined}>
        {rec ? formatEok(rec.amountWon) : '—'}
      </div>
      {rec && <div className="text-[11px] text-muted-foreground">{formatDate(basisDate(rec))}</div>}
    </div>
  )
}

function KeySetup({ onSaved }: { onSaved: (key: string) => void }) {
  const [v, setV] = useState('')
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  return (
    <>
      <PageHeader title="지도" description="카카오맵 JavaScript 키를 넣으면 지도가 켜집니다. 키는 이 브라우저에만 저장되고 백업 파일에는 들어가지 않습니다." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>카카오맵 연결 (처음 한 번)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {typeof window !== 'undefined' && window.location.protocol === 'file:' && (
            <Warn>
              지금은 파일(index.html)을 직접 열어 쓰고 있어 카카오맵을 쓸 수 없습니다. 카카오는 등록한 웹 주소에서만 지도를 열어 줍니다.
              지도가 필요하면 README의 실행 방법대로 <code>npm run dev</code>로 실행해 주세요. 지도 외 기능은 모두 그대로 쓸 수 있습니다.
            </Warn>
          )}
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <a href="https://developers.kakao.com" target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary underline">
                developers.kakao.com <ExternalLink className="size-3" />
              </a>{' '}
              에 카카오 계정으로 로그인합니다.
            </li>
            <li>내 애플리케이션 → 애플리케이션 추가하기 (앱 이름: MY REAL ESTATE LAB 등)</li>
            <li>
              앱 설정 → 플랫폼 → <b>Web 플랫폼 등록</b> → 사이트 도메인에 <code className="rounded bg-muted px-1">{origin}</code> 입력
            </li>
            <li>제품 설정에 '카카오맵' 항목이 보이면 사용 설정을 켭니다.</li>
            <li>
              앱 설정 → 앱 키에서 <b>JavaScript 키</b>를 복사해 아래에 붙여 넣습니다. (REST API 키·Admin 키가 아닙니다)
            </li>
          </ol>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (v.trim()) onSaved(v.trim())
            }}
          >
            <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="JavaScript 키 (32자리)" aria-label="카카오 JavaScript 키" />
            <Button type="submit" disabled={!/^[0-9a-zA-Z]{20,64}$/.test(v.trim())}>
              저장
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">{KAKAO_SETUP_HINT}</p>
        </CardContent>
      </Card>
    </>
  )
}
