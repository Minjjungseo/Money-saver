"use client";

import { Camera, PenLine, FileUp } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { useAddFlow } from "@/lib/context/AddFlowContext";
import { NAV_LABELS } from "@/lib/labels";

const OPTIONS = [
  {
    key: "image" as const,
    icon: Camera,
    title: "이미지로 추가",
    description: "은행 거래내역 스크린샷이나 영수증을 올리면 내용을 읽어드려요.",
  },
  {
    key: "manual" as const,
    icon: PenLine,
    title: "직접 입력",
    description: "금액, 사용처, 카테고리만 입력하면 몇 초면 끝나요.",
  },
  {
    key: "import" as const,
    icon: FileUp,
    title: "파일 불러오기",
    description: "CSV나 JSON 파일에서 거래내역·계좌를 가져와요.",
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
    <Sheet open={mode === "menu"} onClose={close} title={NAV_LABELS.add}>
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
