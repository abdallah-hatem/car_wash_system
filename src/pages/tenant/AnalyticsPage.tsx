import type { CSSProperties } from "react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  BarChart3,
  Banknote,
  CalendarRange,
  CheckCircle2,
  Clock,
  Droplets,
  GitBranch,
  PieChart as PieChartIcon,
  Receipt,
  Sparkles,
  TrendingUp,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { DateRangePicker } from "@/components/tenant/DateRangePicker"
import { useBranches, useWashStats } from "@/lib/tenant/queries"
import { presetRange } from "@/lib/tenant/duration"
import { formatDuration } from "@/lib/tenant/duration"
import { STATS_LIMIT, type StatsFilters } from "@/lib/tenant/washes"
import type { WashStatus } from "@/lib/tenant/operations"
import type { WashStats } from "@/lib/tenant/wash-stats"
import { cn } from "@/lib/utils"

// ─── Palette ──────────────────────────────────────────────────────────────────
// Teal-forward chart palette derived from the app's --primary. Status colors
// mirror statusBadgeClass (amber / blue / green / red) so the donut reads the
// same as the badges elsewhere in the app.

const TEAL = "hsl(174 84% 30%)"
const TEAL_SOFT = "hsl(174 60% 45%)"

const STATUS_COLOR: Record<WashStatus, string> = {
  waiting: "hsl(38 92% 50%)", // amber-500
  in_progress: "hsl(217 91% 60%)", // blue-500
  done: "hsl(142 71% 45%)", // green-500
  cancelled: "hsl(0 84% 60%)", // red-500
}

const STATUS_ORDER: WashStatus[] = ["waiting", "in_progress", "done", "cancelled"]

// ─── Shared primitives (mirrors WashDetailPage) ────────────────────────────────

/** Small rounded icon chip used in every card header. */
function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-[18px] w-[18px]" />
    </span>
  )
}

/** A card with an icon-chip header + title — used for each chart section. */
function SectionCard({
  icon,
  title,
  className,
  style,
  children,
}: {
  icon: LucideIcon
  title: string
  className?: string
  style?: CSSProperties
  children: React.ReactNode
}) {
  return (
    <Card
      className={cn(
        "cw-rise overflow-hidden transition-shadow duration-200 hover:shadow-md",
        className,
      )}
      style={style}
    >
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <IconChip icon={icon} />
        <CardTitle className="text-base font-semibold leading-none">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">{children}</CardContent>
    </Card>
  )
}

/** Centered "no data for this period" filler used inside each chart card. */
function ChartEmpty() {
  const { t } = useTranslation()
  return (
    <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed bg-muted/30">
      <p className="text-sm text-muted-foreground">{t("analytics.noChartData")}</p>
    </div>
  )
}

// ─── KPI cards ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  highlight = false,
  style,
}: {
  label: string
  value: string
  icon: LucideIcon
  highlight?: boolean
  style?: CSSProperties
}) {
  return (
    <Card
      className="cw-rise transition-shadow duration-200 hover:shadow-md"
      style={style}
    >
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <span
            className={cn(
              "truncate text-2xl font-bold tracking-tight tabular-nums sm:text-3xl",
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

function KpiRow({ stats, locale }: { stats: WashStats; locale: string }) {
  const { t } = useTranslation()
  const k = stats.kpis
  const nf = (n: number) => n.toLocaleString(locale)
  const dur = (m: number | null) => formatDuration(m)
  const pct = (r: number | null) =>
    r == null ? "—" : `${Math.round(r * 100)}%`

  const cards: Array<{
    label: string
    value: string
    icon: LucideIcon
    highlight?: boolean
  }> = [
    { label: t("analytics.kpi.revenue"), value: nf(k.revenue), icon: Banknote, highlight: true },
    { label: t("analytics.kpi.washes"), value: nf(k.washCount), icon: Droplets },
    { label: t("analytics.kpi.avgTicket"), value: k.avgTicket == null ? "—" : nf(k.avgTicket), icon: Receipt },
    { label: t("analytics.kpi.completionRate"), value: pct(k.completionRate), icon: CheckCircle2 },
    { label: t("analytics.kpi.avgWait"), value: dur(k.avgWaitMinutes), icon: Clock },
    { label: t("analytics.kpi.avgService"), value: dur(k.avgServiceMinutes), icon: Sparkles },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c, i) => (
        <KpiCard key={c.label} {...c} style={{ animationDelay: `${i * 50}ms` }} />
      ))}
    </div>
  )
}

// ─── Charts ────────────────────────────────────────────────────────────────────

/** Localised short weekday labels (Sun..Sat) from the active locale. */
function useWeekdayLabels(locale: string): string[] {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" })
    // 2023-01-01 is a Sunday → index 0..6 maps Sun..Sat.
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2023, 0, 1 + i)),
    )
  }, [locale])
}

function RevenueTrendChart({ stats, locale }: { stats: WashStats; locale: string }) {
  const { t } = useTranslation()
  const data = stats.revenueByDay
  if (data.length === 0) return <ChartEmpty />

  const config = {
    value: { label: t("analytics.kpi.revenue"), color: TEAL },
  } satisfies ChartConfig

  const dayFmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" })
  const fmtAxis = (d: string) => dayFmt.format(new Date(`${d}T00:00:00`))

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={TEAL} stopOpacity={0.35} />
            <stop offset="95%" stopColor={TEAL} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={fmtAxis}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v: number) => v.toLocaleString(locale)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label) => fmtAxis(String(label))}
              formatter={(value) => (
                <span className="font-mono font-medium tabular-nums">
                  {Number(value).toLocaleString(locale)}
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          stroke={TEAL}
          strokeWidth={2}
          fill="url(#fillRevenue)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}

function StatusDonut({ stats }: { stats: WashStats }) {
  const { t } = useTranslation()
  const data = STATUS_ORDER.map((s) => ({
    status: s,
    label: t(`status.${s}`),
    count: stats.statusBreakdown[s],
    fill: STATUS_COLOR[s],
  })).filter((d) => d.count > 0)

  const total = data.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) return <ChartEmpty />

  const config: ChartConfig = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, { label: t(`status.${s}`), color: STATUS_COLOR[s] }]),
  )

  return (
    <ChartContainer config={config} className="mx-auto aspect-square h-[260px]">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="status"
              hideLabel
              formatter={(value, _name, item) => (
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">
                    {(item?.payload as { label?: string })?.label}
                  </span>
                  <span className="font-mono font-medium tabular-nums">{value}</span>
                </span>
              )}
            />
          }
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="status"
          innerRadius={62}
          outerRadius={92}
          paddingAngle={2}
          strokeWidth={2}
        >
          {data.map((d) => (
            <Cell key={d.status} fill={d.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

/** Compact legend for the status donut (colored dots + label + count). */
function StatusLegend({ stats }: { stats: WashStats }) {
  const { t } = useTranslation()
  return (
    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
      {STATUS_ORDER.map((s) => (
        <li key={s} className="flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ backgroundColor: STATUS_COLOR[s] }}
          />
          <span className="text-muted-foreground">{t(`status.${s}`)}</span>
          <span className="font-medium tabular-nums">{stats.statusBreakdown[s]}</span>
        </li>
      ))}
    </ul>
  )
}

function WeekdayChart({ stats, locale }: { stats: WashStats; locale: string }) {
  const { t } = useTranslation()
  const labels = useWeekdayLabels(locale)
  const data = stats.washesByWeekday.map((d) => ({
    label: labels[d.weekday],
    count: d.count,
  }))
  if (stats.kpis.washCount === 0) return <ChartEmpty />

  const config = {
    count: { label: t("analytics.kpi.washes"), color: TEAL },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="count" fill={TEAL} radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ChartContainer>
  )
}

function HourChart({ stats }: { stats: WashStats }) {
  const { t } = useTranslation()
  const data = stats.washesByHour.map((d) => ({
    hour: d.hour,
    label: `${String(d.hour).padStart(2, "0")}:00`,
    count: d.count,
  }))
  if (stats.kpis.washCount === 0) return <ChartEmpty />

  const config = {
    count: { label: t("analytics.kpi.washes"), color: TEAL_SOFT },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={2}
        />
        <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent labelKey="label" hideLabel />}
        />
        <Bar dataKey="count" fill={TEAL_SOFT} radius={[5, 5, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

/** Top packages — horizontal bar by count, revenue shown in the tooltip. */
function TopPackagesChart({ stats, locale }: { stats: WashStats; locale: string }) {
  const { t } = useTranslation()
  const data = stats.topPackages.slice(0, 8)
  if (data.length === 0) return <ChartEmpty />

  const config = {
    count: { label: t("analytics.kpi.washes"), color: TEAL },
  } satisfies ChartConfig

  const height = Math.max(200, data.length * 40)

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 16, top: 4, bottom: 4 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} hide />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={110}
          tickFormatter={(v: string) => (v.length > 16 ? `${v.slice(0, 15)}…` : v)}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelKey="name"
              formatter={(value, _name, item) => {
                const rev = (item?.payload as { revenue?: number })?.revenue ?? 0
                return (
                  <span className="flex w-full flex-col gap-0.5">
                    <span className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{t("analytics.kpi.washes")}</span>
                      <span className="font-mono font-medium tabular-nums">{value}</span>
                    </span>
                    <span className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{t("analytics.kpi.revenue")}</span>
                      <span className="font-mono font-medium tabular-nums">
                        {rev.toLocaleString(locale)}
                      </span>
                    </span>
                  </span>
                )
              }}
            />
          }
        />
        <Bar dataKey="count" fill={TEAL} radius={5} maxBarSize={28}>
          <LabelList
            dataKey="count"
            position="insideRight"
            className="fill-primary-foreground"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

/** By-branch — washes + revenue (dual bar). Rendered only when >1 branch present. */
function BranchChart({ stats, locale }: { stats: WashStats; locale: string }) {
  const { t } = useTranslation()
  const data = stats.byBranch
  if (data.length === 0) return <ChartEmpty />

  const config = {
    count: { label: t("analytics.kpi.washes"), color: TEAL },
    revenue: { label: t("analytics.kpi.revenue"), color: TEAL_SOFT },
  } satisfies ChartConfig

  return (
    <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
        />
        <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {name === "revenue" ? t("analytics.kpi.revenue") : t("analytics.kpi.washes")}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {Number(value).toLocaleString(locale)}
                  </span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="count" fill={TEAL} radius={[5, 5, 0, 0]} maxBarSize={36} />
        <Bar dataKey="revenue" fill={TEAL_SOFT} radius={[5, 5, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ChartContainer>
  )
}

/** Cancellations by reason — a clean ranked list with counts + share bars. */
function CancellationList({ stats, locale }: { stats: WashStats; locale: string }) {
  const data = stats.cancellationsByReason
  if (data.length === 0) return <ChartEmpty />

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.reason} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 break-words text-sm">{d.reason}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {d.count.toLocaleString(locale)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-destructive/70"
              style={{ width: `${Math.round((d.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// ─── Loading skeleton (mirrors KPI + charts layout) ─────────────────────────────

function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <Skeleton className="h-[220px] w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-4" role="status" aria-busy="true">
      <span className="sr-only">{t("common.loading")}</span>
      {/* KPI skeletons */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 rounded-lg border bg-card p-6"
          >
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-1 h-7 w-16" />
            </div>
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>
      {/* Chart skeletons */}
      <ChartCardSkeleton className="lg:col-span-2" />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language

  const { data: branches = [] } = useBranches()

  const [filters, setFilters] = useState<StatsFilters>(() => {
    const { from, to } = presetRange("last30", new Date())
    return { from, to, branchId: "all" }
  })

  const { data, isLoading, isError, isFetching, refetch } = useWashStats(filters)
  const stats = data?.stats
  const capped = data?.capped ?? false

  const hasData = !!stats && stats.kpis.washCount > 0
  const showBranchChart = branches.length > 1

  // Tasteful staggered entrance for the chart cards (cw-rise).
  const delay = (i: number): CSSProperties => ({ animationDelay: `${i * 60}ms` })

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-3">
        <IconChip icon={BarChart3} />
        <h1 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h1>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">
            {t("analytics.dateRange")}
          </label>
          <DateRangePicker
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => setFilters((p) => ({ ...p, from, to }))}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">
            {t("analytics.branch")}
          </label>
          <Select
            value={filters.branchId}
            onValueChange={(v) => setFilters((p) => ({ ...p, branchId: v }))}
          >
            <SelectTrigger className="min-h-[44px] w-full min-w-[180px] sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("analytics.allBranches")}</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Subtle "refreshing" hint while refiltering with previous data shown */}
        {isFetching && !isLoading && (
          <span className="pb-2.5 text-xs text-muted-foreground" role="status">
            {t("common.loading")}
          </span>
        )}
      </div>

      {/* States */}
      {isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {t("analytics.errors.generic")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => void refetch()}
          >
            {t("common.retry")}
          </Button>
        </div>
      ) : isLoading || !stats ? (
        <LoadingState />
      ) : !hasData ? (
        <Card className="cw-rise border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <BarChart3 className="h-6 w-6" />
            </span>
            <p className="text-sm text-muted-foreground">{t("analytics.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Cap note */}
          {capped && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("analytics.capped", { n: STATS_LIMIT.toLocaleString(locale) })}
            </p>
          )}

          {/* KPI row */}
          <KpiRow stats={stats} locale={locale} />

          {/* Revenue trend — full width */}
          <SectionCard
            icon={TrendingUp}
            title={t("analytics.charts.revenueTrend")}
            style={delay(1)}
          >
            <RevenueTrendChart stats={stats} locale={locale} />
          </SectionCard>

          {/* Charts grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              icon={PieChartIcon}
              title={t("analytics.charts.byStatus")}
              style={delay(2)}
            >
              <StatusDonut stats={stats} />
              <StatusLegend stats={stats} />
            </SectionCard>

            <SectionCard
              icon={CalendarRange}
              title={t("analytics.charts.byWeekday")}
              style={delay(3)}
            >
              <WeekdayChart stats={stats} locale={locale} />
            </SectionCard>

            <SectionCard
              icon={Clock}
              title={t("analytics.charts.byHour")}
              style={delay(4)}
            >
              <HourChart stats={stats} />
            </SectionCard>

            <SectionCard
              icon={Sparkles}
              title={t("analytics.charts.topPackages")}
              style={delay(5)}
            >
              <TopPackagesChart stats={stats} locale={locale} />
            </SectionCard>

            {showBranchChart && (
              <SectionCard
                icon={GitBranch}
                title={t("analytics.charts.byBranch")}
                style={delay(6)}
              >
                <BranchChart stats={stats} locale={locale} />
              </SectionCard>
            )}

            <SectionCard
              icon={XCircle}
              title={t("analytics.charts.cancellations")}
              style={delay(7)}
            >
              <CancellationList stats={stats} locale={locale} />
            </SectionCard>

            <SectionCard
              icon={Users}
              title={t("analytics.charts.topEmployees")}
              style={delay(8)}
            >
              <TopEmployeesList stats={stats} locale={locale} />
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  )
}

/** Top employees — ranked completed-wash list with share bars (teal). */
function TopEmployeesList({ stats, locale }: { stats: WashStats; locale: string }) {
  const data = stats.topEmployees.slice(0, 8)
  if (data.length === 0) return <ChartEmpty />

  const max = Math.max(...data.map((d) => d.count), 1)

  return (
    <ul className="flex flex-col gap-3">
      {data.map((d, i) => (
        <li key={d.name} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold tabular-nums text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 truncate text-sm">{d.name}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold tabular-nums">
              {d.count.toLocaleString(locale)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((d.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
