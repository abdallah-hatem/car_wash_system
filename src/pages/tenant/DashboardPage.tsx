import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Banknote,
  Car,
  Clock,
  Droplets,
  CheckCircle2,
  XCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react"
import { useBranch } from "@/lib/tenant/branch-context"
import { useDashboard } from "@/lib/tenant/queries"
import { StatCardsSkeleton, PageSkeleton } from "@/components/ui/skeletons"

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  highlight?: boolean
}

function StatCard({ label, value, icon: Icon, highlight = false }: StatCardProps) {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span
            className={cn(
              "text-3xl font-bold tracking-tight tabular-nums",
              highlight && "text-primary",
            )}
          >
            {value}
          </span>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            highlight
              ? "bg-primary text-primary-foreground"
              : "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { branchId, loading: branchLoading } = useBranch()

  const { data: stats, isLoading, isError, isFetching, refetch } = useDashboard(branchId)

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

  const isEmpty =
    stats &&
    stats.revenue === 0 &&
    stats.washesToday === 0

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <Button
          variant="outline"
          className="gap-1.5"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          {t("dashboard.refresh")}
        </Button>
      </div>

      {/* Error state */}
      {isError && (
        <div className="flex items-center gap-3">
          <p className="text-sm text-destructive">{t("dashboard.errors.generic")}</p>
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
        <StatCardsSkeleton count={4} />
      )}

      {/* KPI cards */}
      {!isLoading && !isError && stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("dashboard.revenueToday")} value={stats.revenue} icon={Banknote} highlight />
            <StatCard label={t("dashboard.washesToday")} value={stats.washesToday} icon={Car} />
            <StatCard label={t("status.waiting")} value={stats.counts.waiting} icon={Clock} />
            <StatCard label={t("status.in_progress")} value={stats.counts.in_progress} icon={Droplets} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard label={t("status.done")} value={stats.counts.done} icon={CheckCircle2} />
            <StatCard label={t("status.cancelled")} value={stats.counts.cancelled} icon={XCircle} />
          </div>

          {isEmpty && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("dashboard.empty")}
            </p>
          )}
        </>
      )}
    </div>
  )
}
