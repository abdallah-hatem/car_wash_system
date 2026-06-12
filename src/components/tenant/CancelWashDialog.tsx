import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { validateCancelReason } from "@/lib/tenant/operations"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  loading?: boolean
}

const PRESET_KEYS = [
  "wash.cancelPresets.customerLeft",
  "wash.cancelPresets.vehicleIssue",
  "wash.cancelPresets.duplicate",
  "wash.cancelPresets.mistake",
] as const

export function CancelWashDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState("")

  function handleOpenChange(next: boolean) {
    if (!next) setReason("")
    onOpenChange(next)
  }

  function handleConfirm() {
    if (!validateCancelReason(reason)) return
    onConfirm(reason)
  }

  const isValid = validateCancelReason(reason)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>{t("wash.cancelTitle")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {PRESET_KEYS.map((key) => {
              const label = t(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setReason(label)}
                  className="min-h-[44px] px-3 py-1.5 rounded-full border border-input bg-background text-sm hover:bg-muted transition-colors"
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Reason textarea */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cancel-reason">{t("wash.cancelReasonLabel")}</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("wash.cancelReasonPlaceholder")}
              rows={3}
              disabled={loading}
            />
            {!isValid && reason.length > 0 && (
              <p role="alert" className="text-xs text-destructive">
                {t("wash.cancelReasonRequired")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
            className="min-h-[44px]"
          >
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || loading}
            className="min-h-[44px]"
          >
            {t("wash.confirmCancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
