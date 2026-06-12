import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useBranch } from "@/lib/tenant/branch-context"
import { getTodayStats, type DayStats } from "@/lib/tenant/dashboard"

interface StatCardProps {
  label: string
  value: string | number
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { branchId, loading: branchLoading } = useBranch()

  const [stats, setStats] = useState<DayStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    if (!branchId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getTodayStats(branchId)
      setStats(data)
    } catch {
      setError(t("dashboard.errors.generic"))
    } finally {
      setLoading(false)
    }
  }, [branchId, t])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

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
          className="min-h-[44px]"
          onClick={() => void fetchStats()}
          disabled={loading}
        >
          {t("dashboard.refresh")}
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
            onClick={() => void fetchStats()}
          >
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      )}

      {/* KPI cards */}
      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={t("dashboard.revenueToday")} value={stats.revenue} />
            <StatCard label={t("dashboard.washesToday")} value={stats.washesToday} />
            <StatCard label={t("status.waiting")} value={stats.counts.waiting} />
            <StatCard label={t("status.in_progress")} value={stats.counts.in_progress} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StatCard label={t("status.done")} value={stats.counts.done} />
            <StatCard label={t("status.cancelled")} value={stats.counts.cancelled} />
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
