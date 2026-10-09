import { useState, type ReactNode } from 'react'
import { Dialog } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: ReactNode
  confirmLabel?: string
  /** 입력해야 삭제되는 확인 문구 (큰 삭제에 사용) */
  typeToConfirm?: string
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = '삭제', typeToConfirm }: Props) {
  const [typed, setTyped] = useState('')
  const ok = !typeToConfirm || typed.trim() === typeToConfirm
  const close = () => {
    setTyped('')
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={close}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={!ok}
            onClick={() => {
              onConfirm()
              close()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {typeToConfirm && (
        <div className="mt-2">
          <p className="mb-2 text-xs text-muted-foreground">
            확인을 위해 <b className="text-foreground">{typeToConfirm}</b> 을(를) 입력하세요.
          </p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </div>
      )}
    </Dialog>
  )
}
