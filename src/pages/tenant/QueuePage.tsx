import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useBranch } from "@/lib/tenant/branch-context"
import { listQueue, type QueueOrder } from "@/lib/tenant/wash-orders"
import { WashCard } from "@/components/tenant/WashCard"
import { NewWashDialog } from "@/components/tenant/NewWashDialog"

function isToday(iso: string): boolean {
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10)
}

export default function QueuePage() {
  const { t } = useTranslation()
  const { branchId, loading: branchLoading } = useBranch()

  const [orders, setOrders] = useState<QueueOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newWashOpen, setNewWashOpen] = useState(false)

  const fetchQueue = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setError(null)
    try {
      const data = await listQueue(branchId)
      setOrders(data)
    } catch {
      setError(t("queue.errors.generic"))
    } finally {
      setLoading(false)
    }
  }, [branchId, t])

  useEffect(() => {
    void fetchQueue()
  }, [fetchQueue])

  // Partition orders per review flags:
  // - Waiting: status === 'waiting'
  // - In Progress: status === 'in_progress'
  // - Done: status === 'done' AND created_at is today
  // - Cancelled: excluded from board
  const waiting = orders.filter((o) => o.status === "waiting")
  const inProgress = orders.filter((o) => o.status === "in_progress")
  const done = orders.filter((o) => o.status === "done" && isToday(o.created_at))

  if (branchLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }

  if (!branchId) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">{t("queue.branch")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{t("queue.title")}</h1>
        <Button
          className="min-h-[44px]"
          onClick={() => setNewWashOpen(true)}
        >
          {t("queue.newWash")}
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => void fetchQueue()}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {/* Board: 3 responsive columns */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Waiting column */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-2">
              {t("queue.waiting")} ({waiting.length})
            </h2>
            {waiting.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("queue.emptyWaiting")}
              </p>
            ) : (
              waiting.map((order) => (
                <WashCard key={order.id} order={order} onChanged={() => void fetchQueue()} />
              ))
            )}
          </div>

          {/* In Progress column */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-2">
              {t("queue.inProgress")} ({inProgress.length})
            </h2>
            {inProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("queue.emptyInProgress")}
              </p>
            ) : (
              inProgress.map((order) => (
                <WashCard key={order.id} order={order} onChanged={() => void fetchQueue()} />
              ))
            )}
          </div>

          {/* Done column */}
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground border-b pb-2">
              {t("queue.done")} ({done.length})
            </h2>
            {done.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t("queue.emptyDone")}
              </p>
            ) : (
              done.map((order) => (
                <WashCard key={order.id} order={order} onChanged={() => void fetchQueue()} />
              ))
            )}
          </div>
        </div>
      )}

      {/* New Wash Dialog */}
      <NewWashDialog
        open={newWashOpen}
        onOpenChange={setNewWashOpen}
        branchId={branchId}
        onCreated={() => {
          setNewWashOpen(false)
          void fetchQueue()
        }}
      />
    </div>
  )
}
