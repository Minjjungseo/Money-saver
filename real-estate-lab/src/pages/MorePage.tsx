import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { NAV } from '@/components/Layout'
import { PageHeader } from '@/components/bits'

/** 모바일 '더보기' 메뉴 */
export function MorePage() {
  return (
    <>
      <PageHeader title="메뉴" />
      <ul className="divide-y rounded-xl border bg-card">
        {NAV.map((n) => (
          <li key={n.to}>
            <Link to={n.to} className="flex items-center gap-3 px-4 py-3.5 text-sm active:bg-muted">
              <n.icon className="size-5 text-primary" />
              {n.label}
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
