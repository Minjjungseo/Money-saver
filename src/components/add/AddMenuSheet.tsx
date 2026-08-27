"use client";

import { Camera, PenLine, FileUp } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useAddFlow } from "@/lib/context/AddFlowContext";

const OPTIONS = [
  {
    key: "image" as const,
    icon: Camera,
    title: "Add from Image",
    description: "Upload a bank screenshot or receipt and let it read the details.",
  },
  {
    key: "manual" as const,
    icon: PenLine,
    title: "Add Manually",
    description: "Amount, merchant, category — done in a few seconds.",
  },
  {
    key: "import" as const,
    icon: FileUp,
    title: "Import CSV/JSON",
    description: "Bring in transactions or accounts from a file.",
  },
];

export function AddMenuSheet() {
  const { mode, close, openImage, openManual, openImport } = useAddFlow();

  const handlers = {
    image: openImage,
    manual: () => openManual(),
    import: openImport,
  };

  return (
    <Sheet open={mode === "menu"} onClose={close} title="Add">
      <div className="flex flex-col gap-2">
        {OPTIONS.map(({ key, icon: Icon, title, description }) => (
          <button
            key={key}
            onClick={handlers[key]}
            className="flex items-start gap-3.5 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-muted"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Icon size={19} />
            </div>
            <div>
              <p className="text-[15px] font-medium text-ink">{title}</p>
              <p className="text-sm text-ink-muted">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </Sheet>
  );
}
