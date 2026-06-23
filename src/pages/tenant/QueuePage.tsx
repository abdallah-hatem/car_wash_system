import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useBranch } from "@/lib/tenant/branch-context"
import { useQueue, useEmployees } from "@/lib/tenant/queries"
import { isPaid, hasActiveStaff } from "@/lib/tenant/operations"
import { useAuth } from "@/auth/AuthProvider"
import { canEdit } from "@/auth/claims"
import { WashCard } from "@/components/tenant/WashCard"
import { NewWashDialog } from "@/components/tenant/NewWashDialog"
import { BranchFilter } from "@/components/tenant/BranchFilter"
import { CardGridSkeleton, PageSkeleton } from "@/components/ui/skeletons"

// Compare on the LOCAL calendar day (both sides), so an operator outside UTC
// still sees washes finished after local midnight. en-CA gives YYYY-MM-DD.
function isToday(iso: string): boolean {
  return new Date(iso).toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA")
}

export default function QueuePage() {
  const { t } = useTranslation()
  const { branchId, loading: branchLoading } = useBranch()
  const { claims } = useAuth()
  const allowEdit = canEdit(claims, "queue")

  const [newWashOpen, setNewWashOpen] = useState(false)

  const { data: orders = [], isLoading, isError, refetch } = useQueue(branchId)
  const { data: employees = [] } = useEmployees()

  // A wash can't go in_progress without an assigned staff member, so block
  // creating one at a branch that has NO active staff at all (it'd be
  // un-startable). Washes can still queue when staff exist but are all busy.
  const staffAvailable = hasActiveStaff(employees, branchId)
  const canCreateWash = allowEdit && staffAvailable

  // Partition orders:
  // - Waiting: status === 'waiting'
  // - In Progress: status === 'in_progress'
  // - Done: status === 'done' AND (created today OR still unpaid) — unpaid done
  //   orders stay visible regardless of day so their payment can still be recorded.
  // - Cancelled: excluded from board
  const waiting = orders.filter((o) => o.status === "waiting")
  const inProgress = orders.filter((o) => o.status === "in_progress")
  const done = orders.filter(
    (o) => o.status === "done" && (isToday(o.created_at) || !isPaid(o.price, o.payments)),
  )

  if (branchLoading) {
    return <PageSkeleton />
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
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <BranchFilter />
            <Button
              className="gap-1.5"
              disabled={!canCreateWash}
              title={allowEdit && !staffAvailable ? t("queue.noStaffToCreate") : undefined}
              onClick={() => setNewWashOpen(true)}
            >
              <Plus className="h-4 w-4" />
              {t("queue.newWash")}
            </Button>
          </div>
          {allowEdit && !staffAvailable && (
            <p className="text-xs text-muted-foreground text-end">{t("queue.noStaffToCreate")}</p>
          )}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive">{t("queue.errors.generic")}</p>
          <Button
            size="sm"
            variant="outline"
            className="min-h-[44px]"
            onClick={() => void refetch()}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !isError && (
        <CardGridSkeleton count={3} />
      )}

      {/* Board: 3 responsive columns */}
      {!isLoading && !isError && (
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
                <WashCard key={order.id} order={order} branchId={branchId} />
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
                <WashCard key={order.id} order={order} branchId={branchId} />
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
                <WashCard key={order.id} order={order} branchId={branchId} />
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
        onCreated={() => setNewWashOpen(false)}
      />
    </div>
  )
}
