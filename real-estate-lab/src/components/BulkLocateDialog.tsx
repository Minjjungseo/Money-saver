import { useRef, useState } from 'react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Warn } from './bits'
import { toast } from './toast'
import { matchScore, type PlaceCandidate } from '@/lib/geo'
import { searchPlaces } from '@/lib/kakao'
import { nowStamp } from '@/lib/id'
import { regionPath } from '@/lib/selectors'
import { setApartmentLocation } from '@/store/ops'
import { update, useData } from '@/store/store'
import type { Apartment } from '@/store/schema'

interface Row {
  apartment: Apartment
  candidate: PlaceCandidate | null
  score: number
  checked: boolean
  error?: string
}

/**
 * 위치 없는 단지들의 후보를 한꺼번에 검색해 확인 목록으로 보여준다.
 * 이름·분류·지역이 모두 맞는 후보만 미리 체크하고, 저장은 사용자가 확인한 뒤에만 한다.
 */
export function BulkLocateDialog({ open, onClose, apartments, onPickOne }: { open: boolean; onClose: () => void; apartments: Apartment[]; onPickOne: (a: Apartment) => void }) {
  const data = useData()
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const cancel = useRef(false)

  async function start() {
    cancel.current = false
    setRunning(true)
    setDone(0)
    const out: Row[] = []
    for (const a of apartments) {
      if (cancel.current) break
      const names = a.regionId.split('/')
      try {
        const list = await searchPlaces(`${names.slice(-1)[0]} ${a.name}`)
        const scored = list.map((c) => ({ c, s: matchScore(a.name, names, c) })).sort((x, y) => y.s - x.s)
        const best = scored[0]
        out.push({ apartment: a, candidate: best?.c ?? null, score: best?.s ?? 0, checked: (best?.s ?? 0) >= 3 })
      } catch (e) {
        out.push({ apartment: a, candidate: null, score: 0, checked: false, error: e instanceof Error ? e.message : '검색 실패' })
      }
      setRows([...out])
      setDone(out.length)
      await new Promise((r) => setTimeout(r, 120)) // 요청 간격
    }
    setRunning(false)
  }

  function save() {
    const pick = rows.filter((r) => r.checked && r.candidate)
    update(
      (d) =>
        pick.reduce(
          (acc, r) =>
            setApartmentLocation(
              acc,
              r.apartment.id,
              { lat: r.candidate!.lat, lng: r.candidate!.lng, source: 'kakao-place', matchedName: r.candidate!.name, matchedAddress: r.candidate!.roadAddress ?? r.candidate!.address, setAt: nowStamp() },
              r.candidate!.roadAddress ?? r.candidate!.address,
            ),
          d,
        ),
      { undoLabel: `위치 일괄 저장 ${pick.length}개` },
    )
    toast(`${pick.length}개 단지 위치를 저장했습니다`)
    setRows([])
    onClose()
  }

  const checkedCount = rows.filter((r) => r.checked && r.candidate).length

  return (
    <Dialog
      open={open}
      onClose={() => {
        cancel.current = true
        onClose()
      }}
      title={`위치 미확인 단지 찾기 (${apartments.length}개)`}
      description="카카오 장소 검색으로 후보를 찾아 보여드립니다. 맞는 것만 체크해서 저장하세요."
      className="sm:max-w-3xl"
      footer={
        rows.length > 0 && !running ? (
          <>
            <Button variant="outline" onClick={() => setRows([])}>
              다시 검색
            </Button>
            <Button onClick={save} disabled={checkedCount === 0}>
              체크한 {checkedCount}개 저장
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <Warn>이름·분류(아파트)·지역이 모두 맞는 후보만 미리 체크됩니다. 나머지는 이름이 비슷한 다른 단지일 수 있으니 주소를 꼭 확인하세요.</Warn>
        {rows.length === 0 && !running && (
          <Button onClick={start} disabled={apartments.length === 0}>
            후보 검색 시작
          </Button>
        )}
        {running && (
          <div className="flex items-center gap-3 text-sm">
            검색 중… {done}/{apartments.length}
            <Button size="sm" variant="ghost" onClick={() => (cancel.current = true)}>
              멈추기
            </Button>
          </div>
        )}
        {rows.length > 0 && (
          <ul className="max-h-[50vh] divide-y overflow-y-auto rounded-lg border text-sm">
            {rows.map((r, i) => (
              <li key={r.apartment.id} className="flex items-start gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-primary"
                  disabled={!r.candidate}
                  checked={r.checked && !!r.candidate}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, checked: e.target.checked } : x)))}
                  aria-label={`${r.apartment.name} 저장`}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.apartment.name}</div>
                  <div className="text-xs text-muted-foreground">{regionPath(data, r.apartment.regionId)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  {r.candidate ? (
                    <>
                      <div className="flex items-center gap-1">
                        {r.candidate.name}
                        {r.score >= 3 ? <Badge variant="primary">일치</Badge> : <Badge variant="warn">확인 필요</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">{r.candidate.roadAddress ?? r.candidate.address}</div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{r.error ?? '결과 없음'}</span>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => onPickOne(r.apartment)}>
                  직접 고르기
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  )
}
