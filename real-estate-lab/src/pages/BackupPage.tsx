import { useRef, useState } from 'react'
import { Download, FileJson, FileSpreadsheet, FlaskConical, RotateCcw, Upload } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHeader } from '@/components/bits'
import { SheetImportCard } from '@/components/SheetImportCard'
import { toast } from '@/components/toast'
import { addSampleData } from '@/data/sample'
import { csvTemplate, downloadText, exportJSON, exportPricesCSV, importPricesCSV, mergeData, parseBackupJSON, type ImportStats } from '@/lib/backup'
import { todayISO } from '@/lib/date'
import { hasSample, removeSample } from '@/store/ops'
import { getData, replaceAll, update, useData } from '@/store/store'
import { readUndo, STORAGE_KEY } from '@/store/storage'
import type { AppData } from '@/store/schema'

type Pending =
  | { kind: 'csv'; file: string; data: AppData; stats: ImportStats }
  | { kind: 'json'; file: string; incoming: AppData; merged: AppData; stats: ImportStats }

export function BackupPage() {
  const data = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [confirmSample, setConfirmSample] = useState(false)
  const [, force] = useState(0)
  const undo = readUndo()
  const stamp = todayISO()
  const bytes = (localStorage.getItem(STORAGE_KEY) ?? '').length * 2

  async function onFile(f: File) {
    const text = await f.text()
    const cur = getData()
    try {
      if (f.name.toLowerCase().endsWith('.json')) {
        const incoming = parseBackupJSON(text)
        const { data: merged, stats } = mergeData(cur, incoming)
        setPending({ kind: 'json', file: f.name, incoming, merged, stats })
      } else if (f.name.toLowerCase().endsWith('.csv')) {
        const { data: next, stats } = importPricesCSV(cur, text)
        setPending({ kind: 'csv', file: f.name, data: next, stats })
      } else {
        toast('JSON 또는 CSV 파일만 가져올 수 있습니다', 'warn')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : '파일을 읽지 못했습니다', 'warn')
    }
  }

  function applyPending(mode: 'merge' | 'replace') {
    if (!pending) return
    const next = pending.kind === 'csv' ? pending.data : mode === 'merge' ? pending.merged : pending.incoming
    replaceAll(next, `${pending.file} ${mode === 'replace' ? '전체 교체' : '가져오기'}`)
    toast(mode === 'replace' ? '백업 파일로 전체 교체했습니다' : `가격 ${pending.stats.added.prices}건을 가져왔습니다`)
    setPending(null)
  }

  return (
    <>
      <PageHeader title="백업 · 복원" description="데이터는 이 브라우저(localStorage)에만 저장됩니다. 정기적으로 백업 파일을 내려받아 두세요." />

      <div className="grid gap-4 lg:grid-cols-2">
        <SheetImportCard />
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-1.5"><Download className="size-4" />백업 내려받기</CardTitle>
              <CardDescription>
                단지 {data.apartments.length} · 면적 {data.units.length} · 가격 {data.prices.length}건 · 약 {(bytes / 1024).toFixed(0)}KB
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={() => downloadText(`real-estate-lab-backup-${stamp}.json`, exportJSON(data), 'application/json')}>
              <FileJson />
              전체 백업 (JSON)
            </Button>
            <Button variant="outline" onClick={() => downloadText(`real-estate-lab-prices-${stamp}.csv`, exportPricesCSV(data), 'text/csv;charset=utf-8')}>
              <FileSpreadsheet />
              가격 기록 (CSV)
            </Button>
            <p className="w-full text-xs text-muted-foreground">JSON은 앱 전체 복원용, CSV는 엑셀·Google Sheets에서 보기용입니다.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-1.5"><Upload className="size-4" />가져오기 · 복원</CardTitle>
              <CardDescription>저장 전에 미리보기를 보여줍니다. 중복 기록은 자동으로 건너뜁니다.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFile(f)
                e.target.value = ''
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => fileRef.current?.click()}>
                <Upload />
                파일 선택 (JSON/CSV)
              </Button>
              <Button variant="ghost" onClick={() => downloadText('real-estate-lab-template.csv', csvTemplate(), 'text/csv;charset=utf-8')}>
                CSV 양식 받기
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              CSV 필수 열: 시도, 단지명, 전용면적 또는 평형, 가격종류(매매/전세), 금액(억), 조사일. 나머지(시군구, 거래일, 가격유형, 출처URL 등)는 선택입니다.
            </p>
          </CardContent>
        </Card>

        {pending && (
          <Card className="ring-2 ring-primary/30 lg:col-span-2">
            <CardHeader>
              <div>
                <CardTitle>가져오기 미리보기 · {pending.file}</CardTitle>
                <CardDescription>아직 저장되지 않았습니다</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <StatBox label="새 가격 기록" value={pending.stats.added.prices} />
                <StatBox label="새 단지" value={pending.stats.added.apartments} />
                <StatBox label="새 면적" value={pending.stats.added.units} />
                <StatBox label="새 지역" value={pending.stats.added.regions} />
                <StatBox label="중복(건너뜀)" value={pending.stats.duplicates} />
              </ul>
              {pending.stats.errors.length > 0 && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-900 ring-1 ring-red-200">
                  <div className="mb-1 font-semibold">가져오지 않을 행 {pending.stats.errors.length}개</div>
                  <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                    {pending.stats.errors.map((e, i) => (
                      <li key={i}>
                        {e.line ? `${e.line}행: ` : ''}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => applyPending('merge')} disabled={Object.values(pending.stats.added).every((n) => n === 0)}>
                  {pending.kind === 'json' ? '병합해서 가져오기 (권장)' : '가져오기'}
                </Button>
                {pending.kind === 'json' && (
                  <Button variant="outline" onClick={() => setConfirmReplace(true)}>
                    현재 데이터를 백업 내용으로 전체 교체
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setPending(null)}>
                  취소
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-1.5"><RotateCcw className="size-4" />직전 상태로 되돌리기</CardTitle>
              <CardDescription>가져오기·삭제·예시 데이터 삭제 직전 상태 1개를 보관합니다</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {undo ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  <b>{undo.label}</b> 직전 ({new Date(undo.at).toLocaleString('ko-KR')})
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => {
                    replaceAll(undo.data, '되돌리기')
                    force((n) => n + 1)
                    toast('직전 상태로 되돌렸습니다. 한 번 더 누르면 다시 원래대로 돌아갑니다')
                  }}
                >
                  되돌리기
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">되돌릴 기록이 없습니다</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center gap-1.5"><FlaskConical className="size-4" />예시 데이터</CardTitle>
              <CardDescription>가상의 단지·가격입니다. 화면 확인용으로만 쓰세요.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {hasSample(data) ? (
              <Button variant="outline" onClick={() => setConfirmSample(true)}>
                예시 데이터 지우기
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => {
                  update((d) => addSampleData(d, todayISO()))
                  toast('예시 데이터를 넣었습니다 (실제 시세 아님)')
                }}
              >
                예시 데이터 넣기
              </Button>
            )}
          </CardContent>
        </Card>

      </div>

      <ConfirmDialog
        open={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        title="전체 교체"
        description="현재 앱의 모든 데이터가 백업 파일 내용으로 바뀝니다. 교체 직전 상태는 '되돌리기'로 1회 복구할 수 있습니다."
        typeToConfirm="교체"
        confirmLabel="전체 교체"
        onConfirm={() => applyPending('replace')}
      />
      <ConfirmDialog
        open={confirmSample}
        onClose={() => setConfirmSample(false)}
        title="예시 데이터 지우기"
        description="예시로 표시된 단지·가격만 지웁니다. 직접 입력한 기록은 그대로 둡니다."
        confirmLabel="지우기"
        onConfirm={() => {
          update((d) => removeSample(d), { undoLabel: '예시 데이터 삭제' })
          toast('예시 데이터를 지웠습니다')
        }}
      />
    </>
  )
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-lg bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular">{value}</div>
    </li>
  )
}
