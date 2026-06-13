import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Check } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/auth/AuthProvider"
import { remaining } from "@/lib/tenant/operations"
import { usePaymentMutations } from "@/lib/tenant/queries"
import type { QueueOrder } from "@/lib/tenant/wash-orders"

type Method = "cash" | "card" | "transfer"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: QueueOrder
  branchId: string
  onRecorded: () => void
}

export function PaymentDialog({ open, onOpenChange, order, branchId, onRecorded }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()

  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<Method>("cash")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { record } = usePaymentMutations(branchId)

  useEffect(() => {
    if (open) {
      const rem = remaining(order.price, order.payments)
      setAmount(String(rem > 0 ? rem : order.price))
      setMethod("cash")
      setError(null)
    }
  }, [open, order])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setAmount("")
      setMethod("cash")
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const num = parseFloat(amount)
    if (!amount || isNaN(num) || num <= 0) {
      setError(t("payment.errors.generic"))
      return
    }

    if (!claims.tenantId) {
      setError(t("payment.errors.generic"))
      return
    }

    setSubmitting(true)
    try {
      await record.mutateAsync({ tenantId: claims.tenantId, washOrderId: order.id, input: { amount: num, method } })
      handleOpenChange(false)
      onRecorded()
    } catch {
      setError(t("payment.errors.generic"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-sm mx-auto">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{t("payment.title")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-amount">{t("payment.amount")}</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment-method">{t("payment.method")}</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as Method)}
                disabled={submitting}
              >
                <SelectTrigger id="payment-method" className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("payment.cash")}</SelectItem>
                  <SelectItem value="card">{t("payment.card")}</SelectItem>
                  <SelectItem value="transfer">{t("payment.transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {!submitting && <Check className="h-4 w-4" />}
              {submitting ? t("common.loading") : t("payment.record")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
