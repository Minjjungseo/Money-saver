import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'

type Toast = { id: number; text: string; tone: 'ok' | 'warn' }
let seq = 0
let items: Toast[] = []
const subs = new Set<(t: Toast[]) => void>()

export function toast(text: string, tone: Toast['tone'] = 'ok') {
  const t = { id: ++seq, text, tone }
  items = [...items, t]
  subs.forEach((s) => s(items))
  setTimeout(() => {
    items = items.filter((x) => x.id !== t.id)
    subs.forEach((s) => s(items))
  }, 3500)
}

export function Toaster() {
  const [list, setList] = useState<Toast[]>(items)
  useEffect(() => {
    subs.add(setList)
    return () => void subs.delete(setList)
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="pointer-events-auto flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {t.tone === 'ok' ? <CheckCircle2 className="size-4 text-emerald-300" /> : <AlertTriangle className="size-4 text-amber-300" />}
          {t.text}
        </div>
      ))}
    </div>
  )
}
