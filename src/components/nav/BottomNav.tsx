"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, List, CalendarClock, Wallet, PieChart } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/transactions", label: "Transactions", icon: List },
  { href: "/plan", label: "Plan", icon: CalendarClock },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/insights", label: "Insights", icon: PieChart },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/90 backdrop-blur safe-bottom">
      <div className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
            >
              <Icon
                size={22}
                strokeWidth={active ? 2.4 : 1.8}
                className={cn(active ? "text-accent" : "text-ink-faint")}
              />
              <span className={cn(active ? "text-ink" : "text-ink-faint")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
