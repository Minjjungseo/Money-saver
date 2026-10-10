import { useSyncExternalStore } from 'react'
import type { AppData } from './schema'
import { getStorage, loadData, saveData, saveUndo, STORAGE_KEY } from './storage'

/** 'local' = 브라우저에 저장됨, 'memory' = 저장소를 쓸 수 없는 환경(창을 닫으면 사라짐) */
export const storageMode: 'local' | 'memory' = getStorage() ? 'local' : 'memory'
const initial = loadData()
let state: AppData = initial.data
export const loadWarning = initial.warning
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function getData(): AppData {
  return state
}

/**
 * 모든 변경은 여기를 거친다: 새 상태 계산 → localStorage 저장 → 화면 갱신.
 * 저장에 실패하면 화면 상태도 바꾸지 않는다(새로고침 후 사라지는 일이 없도록).
 */
export function update(fn: (d: AppData) => AppData, opts?: { undoLabel?: string }): void {
  const next = fn(state)
  if (next === state) return
  if (storageMode === 'local') {
    if (opts?.undoLabel) saveUndo(state, opts.undoLabel)
    try {
      saveData(next)
    } catch {
      // 저장 실패 시 화면 상태도 바꾸지 않는다 (새로고침 후 사라진 줄 모르는 일이 없도록)
      alert('저장에 실패했습니다. 브라우저 저장 공간을 확인하고, 백업 파일을 먼저 내려받아 주세요.')
      return
    }
  }
  state = next
  emit()
}

export function replaceAll(next: AppData, undoLabel: string): void {
  update(() => next, { undoLabel })
}

export function useData(): AppData {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    getData,
  )
}

// 다른 탭에서 바뀐 내용을 반영
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    const r = loadData()
    if (!r.warning) {
      state = r.data
      emit()
    }
  })
}
