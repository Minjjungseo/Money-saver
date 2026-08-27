"use client";

import { DataProvider } from "@/lib/context/DataContext";
import { AddFlowProvider } from "@/lib/context/AddFlowContext";
import { BottomNav } from "@/components/nav/BottomNav";
import { AddFab } from "@/components/nav/AddFab";
import { AddFlowSheets } from "@/components/add/AddFlowSheets";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <AddFlowProvider>
        <div className="mx-auto flex min-h-screen max-w-lg flex-col">
          <main className="flex-1 pb-28">{children}</main>
        </div>
        <BottomNav />
        <AddFab />
        <AddFlowSheets />
      </AddFlowProvider>
    </DataProvider>
  );
}
