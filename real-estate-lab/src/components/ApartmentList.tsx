import { Link } from 'react-router-dom'
import { AlertTriangle, Star } from 'lucide-react'
import { Table, Td, Th } from './ui/table'
import { ChangeText, PriceTypeBadge, SampleBadge } from './bits'
import { RATIO_DATE_GAP_WARN_DAYS, basisDate } from '@/lib/calc'
import { formatDate } from '@/lib/date'
import { formatEok, formatKoreanWon, formatPct } from '@/lib/money'
import { apartmentUrl } from '@/lib/routes'
import { regionPath, unitLabel, type AptSummary } from '@/lib/selectors'
import type { AppData, PriceRecord } from '@/store/schema'

export function ApartmentList({ data, items }: { data: AppData; items: AptSummary[] }) {
  return (
    <>
      {/* 데스크톱: 표 */}
      <div className="hidden rounded-xl border bg-card md:block">
        <Table>
          <thead>
            <tr>
              <Th>단지</Th>
              <Th>대표 면적</Th>
              <Th className="text-right">매매</Th>
              <Th className="text-right">전세</Th>
              <Th className="text-right">전세가율</Th>
              <Th className="text-right">매매 변동</Th>
              <Th className="text-right">최근 조사일</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.apartment.id} className="hover:bg-muted/50">
                <Td>
                  <div className="flex items-center gap-1.5">
                    {s.apartment.isLandmark && <Star className="size-3.5 fill-amber-400 text-amber-400" aria-label="대표 단지" />}
                    <Link to={apartmentUrl(s.apartment.id)} className="font-medium hover:underline">
                      {s.apartment.name}
                    </Link>
                    <SampleBadge show={s.apartment.isSample} />
                  </div>
                  <div className="text-xs text-muted-foreground">{regionPath(data, s.apartment.regionId)}</div>
                </Td>
                <Td className="text-xs text-muted-foreground">{s.unit ? unitLabel(s.unit) : '면적 없음'}</Td>
                <Td className="text-right">
                  <PriceCell r={s.sale} />
                </Td>
                <Td className="text-right">
                  <PriceCell r={s.jeonse} />
                </Td>
                <Td className="text-right">
                  <RatioCell s={s} />
                </Td>
                <Td className="text-right">
                  <ChangeText change={s.saleChange} showAmount={false} />
                </Td>
                <Td className="text-right text-xs text-muted-foreground">{formatDate(s.lastSurvey)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* 모바일: 카드 */}
      <ul className="space-y-2 md:hidden">
        {items.map((s) => (
          <li key={s.apartment.id}>
            <Link to={apartmentUrl(s.apartment.id)} className="block rounded-xl border bg-card p-4 active:bg-muted">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {s.apartment.isLandmark && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                    <span className="truncate font-semibold">{s.apartment.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {regionPath(data, s.apartment.regionId)} · {s.unit ? unitLabel(s.unit) : '면적 없음'}
                  </div>
                </div>
                <SampleBadge show={s.apartment.isSample} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-[11px] text-muted-foreground">매매</div>
                  <div className="font-semibold tabular">{s.sale ? formatEok(s.sale.amountWon) : '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">전세</div>
                  <div className="font-semibold tabular">{s.jeonse ? formatEok(s.jeonse.amountWon) : '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">전세가율</div>
                  <RatioCell s={s} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <ChangeText change={s.saleChange} showAmount={false} />
                <span className="text-muted-foreground">조사 {formatDate(s.lastSurvey)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function PriceCell({ r }: { r: PriceRecord | null }) {
  if (!r) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-semibold" title={formatKoreanWon(r.amountWon)}>
        {formatEok(r.amountWon)}
      </span>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <PriceTypeBadge type={r.priceType} />
        {formatDate(basisDate(r))}
      </span>
    </div>
  )
}

function RatioCell({ s }: { s: AptSummary }) {
  if (s.ratio == null) return <span className="text-muted-foreground">—</span>
  const warn = s.ratioGapDays != null && s.ratioGapDays > RATIO_DATE_GAP_WARN_DAYS
  return (
    <span className="inline-flex items-center gap-1 font-semibold tabular" title={warn ? `매매·전세 기준일이 ${s.ratioGapDays}일 차이납니다` : undefined}>
      {formatPct(s.ratio, 1, false)}
      {warn && <AlertTriangle className="size-3.5 text-orange-500" aria-label="기준일 차이 큼" />}
    </span>
  )
}
