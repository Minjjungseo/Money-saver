import { useEffect, useRef, useState } from 'react'
import { loadKakao } from '@/lib/kakao'

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface MapPoint {
  id: string
  lat: number
  lng: number
  title: string
  sub: string
  bg: string
  fg: string
  dimmed: boolean
  selected: boolean
  compared: boolean
}

interface Props {
  points: MapPoint[]
  /** 생활권 외곽선 (소속 단지 위치를 이은 볼록 다각형) */
  hull: { lat: number; lng: number }[]
  /** 값이 바뀌면 보이는 단지들에 맞춰 지도 범위를 다시 잡는다 */
  fitKey: string
  onSelect: (id: string) => void
  onError: (message: string) => void
  height?: number
}

/** 카카오맵 위에 가격 라벨(CustomOverlay)을 그린다. 위치가 없는 단지는 points에 들어오지 않는다. */
export function KakaoMap({ points, hull, fitKey, onSelect, onError, height = 560 }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const overlays = useRef<any[]>([])
  const polygon = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect

  // 지도 생성 (한 번)
  useEffect(() => {
    let cancelled = false
    loadKakao()
      .then((kakao) => {
        if (cancelled || !box.current) return
        map.current = new kakao.maps.Map(box.current, { center: new kakao.maps.LatLng(37.5172, 127.0473), level: 8 })
        map.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
        setReady(true)
      })
      .catch((e: Error) => !cancelled && onError(e.message))
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 라벨 다시 그리기
  useEffect(() => {
    if (!ready) return
    const kakao = window.kakao
    overlays.current.forEach((o) => o.setMap(null))
    overlays.current = points.map((p) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'mrel-pin'
      el.setAttribute('aria-label', `${p.title} ${p.sub}`)
      el.style.cssText = [
        `background:${p.bg}`,
        `color:${p.fg}`,
        `opacity:${p.dimmed ? 0.35 : 1}`,
        `border:2px solid ${p.selected ? '#0f172a' : p.compared ? '#e34948' : 'rgba(15,23,42,.25)'}`,
        `z-index:${p.selected ? 3 : p.compared ? 2 : 1}`,
      ].join(';')
      el.innerHTML = `<span class="mrel-pin-title"></span><span class="mrel-pin-sub"></span>`
      ;(el.children[0] as HTMLElement).textContent = p.title
      ;(el.children[1] as HTMLElement).textContent = p.sub
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        selectRef.current(p.id)
      })
      const o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: el, yAnchor: 1.1, zIndex: p.selected ? 3 : 1, clickable: true })
      o.setMap(map.current)
      return o
    })
  }, [ready, points])

  // 생활권 외곽선
  useEffect(() => {
    if (!ready) return
    const kakao = window.kakao
    polygon.current?.setMap(null)
    polygon.current = null
    if (hull.length >= 3) {
      polygon.current = new kakao.maps.Polygon({
        path: hull.map((h) => new kakao.maps.LatLng(h.lat, h.lng)),
        strokeWeight: 2,
        strokeColor: '#1e3a8a',
        strokeOpacity: 0.8,
        strokeStyle: 'dash',
        fillColor: '#1e3a8a',
        fillOpacity: 0.06,
      })
      polygon.current.setMap(map.current)
    }
  }, [ready, hull])

  // 범위 맞추기
  useEffect(() => {
    if (!ready || points.length === 0) return
    const kakao = window.kakao
    const visible = points.filter((p) => !p.dimmed)
    const target = visible.length ? visible : points
    if (target.length === 1) {
      map.current.setCenter(new kakao.maps.LatLng(target[0].lat, target[0].lng))
      map.current.setLevel(4)
      return
    }
    const b = new kakao.maps.LatLngBounds()
    target.forEach((p) => b.extend(new kakao.maps.LatLng(p.lat, p.lng)))
    map.current.setBounds(b)
  }, [ready, fitKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // 컨테이너 크기 변화 반영
  useEffect(() => {
    if (!ready || !box.current) return
    const ro = new ResizeObserver(() => map.current?.relayout())
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [ready])

  return (
    <div className="relative overflow-hidden rounded-xl border bg-muted" style={{ height }}>
      <div ref={box} className="absolute inset-0" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">카카오맵 불러오는 중…</div>}
    </div>
  )
}
