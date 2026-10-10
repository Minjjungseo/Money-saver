import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Search } from 'lucide-react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Field } from './ApartmentFormDialog'
import { Segmented } from './Segmented'
import { Warn } from './bits'
import { toast } from './toast'
import { matchScore, parseCoord, type PlaceCandidate } from '@/lib/geo'
import { getKakaoKey, searchAddress, searchPlaces } from '@/lib/kakao'
import { nowStamp } from '@/lib/id'
import { setApartmentLocation } from '@/store/ops'
import { update } from '@/store/store'
import { LOCATION_SOURCE_LABEL, type Apartment, type ApartmentLocation } from '@/store/schema'

type Mode = 'place' | 'address' | 'manual'

/**
 * 단지 위치 정하기. 검색 결과를 사용자가 직접 골라야 저장된다 (자동 확정 없음).
 */
export function LocationDialog({ apartment, onClose }: { apartment: Apartment | null; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('place')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceCandidate[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const hasKey = !!getKakaoKey()
  const regionNames = apartment ? apartment.regionId.split('/') : []

  useEffect(() => {
    if (!apartment) return
    setMode(hasKey ? 'place' : 'manual')
    setQuery(`${regionNames.slice(-1)[0] ?? ''} ${apartment.name}`.trim())
    setResults(null)
    setError('')
    setLat(apartment.location?.lat.toString() ?? '')
    setLng(apartment.location?.lng.toString() ?? '')
  }, [apartment]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!apartment) return null

  async function run() {
    setBusy(true)
    setError('')
    try {
      const r = mode === 'address' ? await searchAddress(query) : await searchPlaces(query)
      setResults(r.slice(0, 10))
    } catch (e) {
      setError(e instanceof Error ? e.message : '검색하지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  function save(loc: ApartmentLocation, address?: string | null) {
    update((d) => setApartmentLocation(d, apartment!.id, loc, address), { undoLabel: `위치 설정: ${apartment!.name}` })
    toast('위치를 저장했습니다')
    onClose()
  }

  function pick(c: PlaceCandidate) {
    save(
      { lat: c.lat, lng: c.lng, source: mode === 'address' ? 'kakao-address' : 'kakao-place', matchedName: c.name, matchedAddress: c.roadAddress ?? c.address, setAt: nowStamp() },
      c.roadAddress ?? c.address,
    )
  }

  function saveManual() {
    const p = parseCoord(lat, lng)
    if (!p.ok) return setError(p.error)
    save({ lat: p.lat, lng: p.lng, source: 'manual', matchedName: null, matchedAddress: null, setAt: nowStamp() })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`위치 정하기 · ${apartment.name}`}
      description="검색 결과 중 이 단지가 맞는 곳을 직접 골라 주세요. 고르지 않으면 지도에 표시되지 않습니다."
      className="sm:max-w-xl"
    >
      <div className="space-y-3">
        {apartment.location && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
            <MapPin className="size-3.5" />
            현재: {apartment.location.matchedName ?? '직접 입력'} · {LOCATION_SOURCE_LABEL[apartment.location.source]}
            <span className="text-muted-foreground">
              ({apartment.location.lat.toFixed(5)}, {apartment.location.lng.toFixed(5)})
            </span>
            <button
              className="ml-auto text-destructive underline"
              onClick={() => {
                update((d) => setApartmentLocation(d, apartment.id, null), { undoLabel: `위치 지우기: ${apartment.name}` })
                toast('위치를 지웠습니다', 'warn')
                onClose()
              }}
            >
              위치 지우기
            </button>
          </div>
        )}

        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setResults(null)
            setError('')
            if (m === 'address' && apartment.address) setQuery(apartment.address)
            if (m === 'place') setQuery(`${regionNames.slice(-1)[0] ?? ''} ${apartment.name}`.trim())
          }}
          label="방법"
          options={[
            ['place', '단지명 검색'],
            ['address', '주소 검색'],
            ['manual', '좌표 직접 입력'],
          ]}
        />

        {mode !== 'manual' && !hasKey && (
          <Warn>
            카카오 JavaScript 키가 아직 없습니다. <Link to="/map" className="underline" onClick={onClose}>지도 화면</Link>에서 키를 넣으면 검색할 수 있어요.
          </Warn>
        )}

        {mode !== 'manual' ? (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (query.trim()) run()
              }}
            >
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={mode === 'address' ? '도로명 또는 지번 주소' : '지역 + 단지명'} />
              <Button type="submit" disabled={!hasKey || busy || !query.trim()}>
                <Search />
                {busy ? '검색 중' : '검색'}
              </Button>
            </form>
            {results && results.length === 0 && <p className="text-sm text-muted-foreground">결과가 없습니다. 검색어를 바꿔 보세요 (예: 동 이름 + 단지명).</p>}
            {results && results.length > 0 && (
              <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
                {results.map((c, i) => {
                  const score = matchScore(apartment.name, regionNames, c)
                  return (
                    <li key={i} className="flex items-start gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.roadAddress ?? c.address}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {c.category && <Badge variant="outline">{c.category.split('>').slice(-1)[0].trim()}</Badge>}
                          {mode === 'place' && score >= 3 && <Badge variant="primary">이름·분류·지역 일치</Badge>}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => pick(c)}>
                        이 위치
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <Field label="위도 (예: 37.5112)">
                <Input inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
              </Field>
              <Field label="경도 (예: 127.0981)">
                <Input inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">카카오맵·네이버지도에서 단지를 찾아 확인한 좌표만 넣어 주세요.</p>
            <Button onClick={saveManual}>좌표 저장</Button>
          </div>
        )}
        {error && <Warn>{error}</Warn>}
      </div>
    </Dialog>
  )
}
