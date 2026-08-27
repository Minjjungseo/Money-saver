"use client";

import { Plus } from "lucide-react";
import { useAddFlow } from "@/lib/context/AddFlowContext";

export function AddFab() {
  const { openMenu } = useAddFlow();
  return (
    <button
      onClick={openMenu}
      aria-label="Add"
      className="fixed z-40 right-5 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 transition-transform active:scale-95"
    >
      <Plus size={26} strokeWidth={2.5} />
    </button>
  );
}
