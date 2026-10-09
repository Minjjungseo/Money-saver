import { useRef, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Table, Td, Th } from './ui/table'
import { Warn } from './bits'
import { toast } from './toast'
import { importTrackingSheet, type SheetImportResult, type SheetRows } from '@/lib/sheetImport'
import { formatDate } from '@/lib/date'
import { getData, replaceAll } from '@/store/store'

const TRACKING = '시세트래킹'
const LANDMARK = '전국 랜드마크 가격 순서'

export function SheetImportCard() {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<(SheetImportResult & { file: string }) | null>(null)

  async function onFile(f: File) {
    setBusy(true)
    try {
      // 큰 라이브러리라 필요할 때만 불러온다
      const { readSheet } = await import('read-excel-file/universal')
      const tracking = (await readSheet(f, TRACKING).catch(() => {
        throw new Error(`"${TRACKING}" 탭을 찾지 못했습니다`)
      })) as SheetRows
      const landmark = (await readSheet(f, LANDMARK).catch(() => null)) as SheetRows | null
      setResult({ ...importTrackingSheet(getData(), tracking, landmark), file: f.name })
    } catch (e) {
      toast(e instanceof Error ? e.message : '파일을 읽지 못했습니다', 'warn')
    } finally {
      setBusy(false)
    }
  }

  function apply() {
    if (!result) return
    replaceAll(result.data, `${result.file} 시트 가져오기`)
    toast(`단지 ${result.stats.apartments}개, 가격 ${result.stats.prices}건을 가져왔습니다`)
    setResult(null)
  }

  const noted = result?.rows.filter((r) => r.note) ?? []

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-1.5">
            <FileSpreadsheet className="size-4" />
            기존 Google Sheets(.xlsx) 가져오기
          </CardTitle>
          <CardDescription>
            "{TRACKING}" 탭의 날짜별 매매·전세와 "{LANDMARK}" 탭의 세대수·연식을 가져옵니다. 파일은 이 브라우저 안에서만 읽고, 원본 시트는 바뀌지 않습니다.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <input
          ref={ref}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFile(f)
            e.target.value = ''
          }}
        />
        {!result && (
          <>
            <Button onClick={() => ref.current?.click()} disabled={busy}>
              <Upload />
              {busy ? '읽는 중…' : '.xlsx 파일 선택'}
            </Button>
            <p className="text-xs text-muted-foreground">Google Sheets에서 파일 → 다운로드 → Microsoft Excel(.xlsx)로 받은 파일을 선택하세요.</p>
            <Warn>
              시트에는 실거래가인지 호가인지 적혀 있지 않아, 모든 가격을 <b>가격유형 '기타' · '과거자료'</b>로 가져옵니다. 평형(34")은 전용면적으로 바꾸지 않고
              평형 그대로 둡니다. 앞으로 입력하는 실거래가와는 그래프에서 다른 선으로 표시됩니다.
            </Warn>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="rounded-lg bg-accent px-3 py-2 text-primary">
              <b>{result.file}</b> · 조사일 {result.dates.length}회 ({formatDate(result.dates[0])} ~ {formatDate(result.dates.at(-1))}) · 아직 저장되지 않았습니다
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ['새 단지', result.stats.apartments],
                ['새 면적(평형)', result.stats.units],
                ['새 가격 기록', result.stats.prices],
                ['새 지역', result.stats.regions],
                ['중복(건너뜀)', result.stats.duplicates],
              ].map(([l, v]) => (
                <li key={l} className="rounded-lg bg-muted px-3 py-2">
                  <div className="text-xs text-muted-foreground">{l}</div>
                  <div className="text-lg font-semibold tabular">{v}</div>
                </li>
              ))}
            </ul>
            {result.warnings.map((w) => (
              <Warn key={w}>{w}</Warn>
            ))}
            {noted.length > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold">확인이 필요한 지역 매핑 {noted.length}건</div>
                <ul className="space-y-1 rounded-lg bg-orange-50 p-3 text-xs text-orange-900 ring-1 ring-orange-200">
                  {noted.map((r) => (
                    <li key={r.line}>
                      {r.line}행 {r.name} → <b>{r.regionId.replace(/\//g, ' ')}</b> · {r.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <details className="rounded-lg border">
              <summary className="cursor-pointer px-3 py-2 text-xs font-medium">전체 지역 매핑 보기 ({result.rows.length}개 단지)</summary>
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <thead>
                    <tr>
                      <Th>행</Th>
                      <Th>원본 구역</Th>
                      <Th>원본 지역</Th>
                      <Th>원본 단지명</Th>
                      <Th>앱 지역</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.line}>
                        <Td className="text-xs text-muted-foreground">{r.line}</Td>
                        <Td className="text-xs">{r.section}</Td>
                        <Td className="text-xs">{r.rawRegion || '(빈칸)'}</Td>
                        <Td className="text-xs">{r.name}</Td>
                        <Td className="text-xs font-medium">{r.regionId.replace(/\//g, ' ')}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </details>
            <div className="flex flex-wrap gap-2">
              <Button onClick={apply} disabled={result.stats.prices + result.stats.apartments === 0}>
                가져오기
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                취소
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">가져온 직후에는 '직전 상태로 되돌리기'로 취소할 수 있습니다. 같은 파일을 다시 가져와도 중복 기록은 생기지 않습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
