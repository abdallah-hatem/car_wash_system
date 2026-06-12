import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Banknote, Check, Play, X } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { canTransition, isPaid, remaining } from "@/lib/tenant/operations"
import { startWashOrder, completeWashOrder, cancelWashOrder, type QueueOrder } from "@/lib/tenant/wash-orders"
import { AssignStartDialog } from "./AssignStartDialog"
import { PaymentDialog } from "./PaymentDialog"

interface Props {
  order: QueueOrder
  onChanged: () => void
}

export function WashCard({ order, onChanged }: Props) {
  const { t } = useTranslation()
  const [assignOpen, setAssignOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paid = isPaid(order.price, order.payments)
  const rem = remaining(order.price, order.payments)

  async function handleStart(employeeId: string | null) {
    if (!canTransition(order.status, "in_progress")) return
    setActing(true)
    setError(null)
    try {
      await startWashOrder(order.id, employeeId)
      setAssignOpen(false)
      onChanged()
    } catch {
      setError(t("wash.errors.generic"))
    } finally {
      setActing(false)
    }
  }

  async function handleComplete() {
    if (!canTransition(order.status, "done")) return
    setActing(true)
    setError(null)
    try {
      await completeWashOrder(order.id)
      onChanged()
    } catch {
      setError(t("wash.errors.generic"))
    } finally {
      setActing(false)
    }
  }

  async function handleCancel() {
    if (!canTransition(order.status, "cancelled")) return
    if (!window.confirm(t("wash.cancelConfirm"))) return
    setActing(true)
    setError(null)
    try {
      await cancelWashOrder(order.id)
      onChanged()
    } catch {
      setError(t("wash.errors.generic"))
    } finally {
      setActing(false)
    }
  }

  const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    waiting: "secondary",
    in_progress: "default",
    done: "outline",
    cancelled: "destructive",
  }

  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="pb-2 gap-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-base tracking-wide">
            {order.plate_number ?? "—"}
          </span>
          <Badge variant={statusVariant[order.status] ?? "secondary"}>
            {t(`status.${order.status}`)}
          </Badge>
        </div>
        {order.customer_name && (
          <p className="text-sm text-muted-foreground">{order.customer_name}</p>
        )}
      </CardHeader>

      <CardContent className="pb-3 flex flex-col gap-1.5 text-sm">
        {order.package_name && (
          <p>
            <span className="text-muted-foreground">{t("wash.package")}: </span>
            {order.package_name}
          </p>
        )}
        <p>
          <span className="text-muted-foreground">{t("wash.price")}: </span>
          {order.price}
        </p>
        {order.employee_name && (
          <p>
            <span className="text-muted-foreground">{t("wash.assignedTo")}: </span>
            {order.employee_name}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1">
          <Badge variant={paid ? "default" : "destructive"}>
            {paid ? t("wash.paid") : t("wash.unpaid")}
          </Badge>
          {!paid && rem > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("wash.remaining")}: {rem}
            </span>
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs text-destructive mt-1">
            {error}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-0">
        {canTransition(order.status, "in_progress") && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setAssignOpen(true)}
            disabled={acting}
          >
            <Play className="h-4 w-4" />
            {t("wash.start")}
          </Button>
        )}

        {canTransition(order.status, "done") && (
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => void handleComplete()}
            disabled={acting}
          >
            <Check className="h-4 w-4" />
            {t("wash.complete")}
          </Button>
        )}

        {canTransition(order.status, "cancelled") && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void handleCancel()}
            disabled={acting}
          >
            <X className="h-4 w-4" />
            {t("wash.cancel")}
          </Button>
        )}

        {order.status === "done" && !paid && (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={() => setPayOpen(true)}
            disabled={acting}
          >
            <Banknote className="h-4 w-4" />
            {t("payment.record")}
          </Button>
        )}
      </CardFooter>

      <AssignStartDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onConfirm={(empId) => void handleStart(empId)}
        loading={acting}
      />

      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        order={order}
        onRecorded={() => {
          setPayOpen(false)
          onChanged()
        }}
      />
    </Card>
  )
}
