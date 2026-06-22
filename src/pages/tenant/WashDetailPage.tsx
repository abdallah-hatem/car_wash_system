import type { CSSProperties } from "react"
import { useParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  ChevronLeft,
  User,
  Phone,
  Car,
  Sparkles,
  UserCog,
  GitBranch,
  Clock,
  Banknote,
  StickyNote,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useWash } from "@/lib/tenant/queries"
import type { WashDetail, WashPayment } from "@/lib/tenant/washes"
import { statusBadgeClass } from "@/lib/tenant/status-style"
import { isPaid, amountPaid, remaining } from "@/lib/tenant/operations"
import { diffMinutes, formatDuration } from "@/lib/tenant/duration"
import { cn } from "@/lib/utils"

// ─── Shared primitives ──────────────────────────────────────────────────────

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/app/washes"
      className="inline-flex w-fit min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      {t("washes.back")}
    </Link>
  )
}

/** Small rounded icon chip used in every card header (matches DashboardPage chips). */
function IconChip({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-[18px] w-[18px]" />
    </span>
  )
}

/** A card with an icon-chip header + title, used for each detail section. */
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

/** Muted label + bold value row; falls back to an em dash for empty values. */
function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
}) {
  const empty = value == null || value === ""
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground/70" aria-hidden />}
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 break-words text-end text-sm font-medium",
          empty && "text-muted-foreground",
        )}
      >
        {empty ? "—" : value}
      </span>
    </div>
  )
}

// ─── Section cards ──────────────────────────────────────────────────────────

function CustomerCard({ wash, style }: { wash: WashDetail; style?: CSSProperties }) {
  const { t } = useTranslation()
  return (
    <SectionCard icon={User} title={t("washes.sectionCustomer")} style={style}>
      <div className="divide-y">
        <DetailRow
          label={t("customers.name")}
          value={
            wash.customer_id && wash.customer_name ? (
              <Link
                to={`/app/customers/${wash.customer_id}`}
                className="text-primary underline-offset-4 hover:underline"
              >
                {wash.customer_name}
              </Link>
            ) : (
              wash.customer_name
            )
          }
        />
        <DetailRow icon={Phone} label={t("customers.phone")} value={wash.customer_phone} />
      </div>
    </SectionCard>
  )
}

function VehicleCard({ wash, style }: { wash: WashDetail; style?: CSSProperties }) {
  const { t } = useTranslation()
  return (
    <SectionCard icon={Car} title={t("washes.sectionVehicle")} style={style}>
      <div className="divide-y">
        <DetailRow label={t("wash.plate")} value={wash.plate_number} />
        <DetailRow label={t("vehicles.make")} value={wash.vehicle_make} />
        <DetailRow label={t("vehicles.model")} value={wash.vehicle_model} />
        <DetailRow label={t("vehicles.color")} value={wash.vehicle_color} />
      </div>
    </SectionCard>
  )
}

function ServiceCard({ wash, style }: { wash: WashDetail; style?: CSSProperties }) {
  const { t, i18n } = useTranslation()
  return (
    <SectionCard icon={Sparkles} title={t("washes.sectionService")} style={style}>
      {/* Package + price — price emphasized in teal */}
      <div className="flex items-end justify-between gap-4 rounded-lg bg-muted/50 p-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{t("wash.package")}</div>
          <div className="truncate text-sm font-semibold">{wash.package_name ?? "—"}</div>
        </div>
        <div className="text-end">
          <div className="text-xs text-muted-foreground">{t("wash.price")}</div>
          <div className="text-xl font-bold tabular-nums text-primary">
            {wash.price.toLocaleString(i18n.language)}
          </div>
        </div>
      </div>
      <div className="mt-1 divide-y">
        <DetailRow icon={UserCog} label={t("wash.assignedTo")} value={wash.employee_name} />
        <DetailRow icon={GitBranch} label={t("washes.colBranch")} value={wash.branch_name} />
      </div>
      {wash.notes && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5" aria-hidden />
            {t("wash.notes")}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm">{wash.notes}</p>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Timeline ───────────────────────────────────────────────────────────────

function TimelineStep({
  label,
  time,
  state,
  isLast,
}: {
  label: string
  time: string
  state: "done" | "current" | "cancelled" | "pending"
  isLast?: boolean
}) {
  const dotClass =
    state === "done" || state === "current"
      ? "border-primary bg-primary"
      : state === "cancelled"
        ? "border-destructive bg-destructive"
        : "border-muted-foreground/30 bg-background"
  return (
    <li className="relative flex gap-3 ps-1">
      {/* Connector line: from this dot's center down to the next step */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute bottom-0 start-[10px] top-3 w-px bg-border"
        />
      )}
      <span
        aria-hidden
        className={cn(
          "relative z-10 mt-1 h-[14px] w-[14px] shrink-0 rounded-full border-2",
          dotClass,
        )}
      />
      <div className="-mt-0.5 flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 pb-5">
        <span
          className={cn(
            "text-sm font-medium",
            state === "pending" && "text-muted-foreground",
            state === "cancelled" && "text-destructive",
          )}
        >
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">{time}</span>
      </div>
    </li>
  )
}

function TimelineCard({ wash, style }: { wash: WashDetail; style?: CSSProperties }) {
  const { t, i18n } = useTranslation()
  const cancelled = wash.status === "cancelled"

  const fmtDate = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleString(i18n.language) : "—"

  const wait = formatDuration(diffMinutes(wash.created_at, wash.started_at))
  const serviceDur = formatDuration(diffMinutes(wash.started_at, wash.completed_at))

  return (
    <SectionCard
      icon={Clock}
      title={t("washes.sectionTimeline")}
      className="sm:col-span-2"
      style={style}
    >
      <ol className="mt-1">
        <TimelineStep
          label={t("washes.queued")}
          time={fmtDate(wash.created_at)}
          state="done"
        />
        <TimelineStep
          label={t("washes.started")}
          time={fmtDate(wash.started_at)}
          state={wash.started_at ? "done" : "pending"}
        />
        {cancelled ? (
          <TimelineStep
            label={t("washes.cancelledAt")}
            time={fmtDate(wash.cancelled_at)}
            state="cancelled"
            isLast
          />
        ) : (
          <TimelineStep
            label={t("washes.completed")}
            time={fmtDate(wash.completed_at)}
            state={wash.completed_at ? "current" : "pending"}
            isLast
          />
        )}
      </ol>

      {/* Duration chips */}
      <div className="flex flex-wrap gap-2 border-t pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          <span className="text-muted-foreground">{t("washes.waitDuration")}</span>
          <span className="tabular-nums">{wait}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
          <span className="text-muted-foreground">{t("washes.serviceDuration")}</span>
          <span className="tabular-nums">{serviceDur}</span>
        </span>
      </div>

      {/* Cancellation reason — destructive-tinted note */}
      {cancelled && wash.cancellation_reason && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <div className="text-xs font-medium text-destructive">{t("washes.colReason")}</div>
          <p className="mt-1 break-words text-sm text-destructive">
            {wash.cancellation_reason}
          </p>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Payments ───────────────────────────────────────────────────────────────

function PaymentRow({ payment }: { payment: WashPayment }) {
  const { t, i18n } = useTranslation()
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-semibold tabular-nums">
          {payment.amount.toLocaleString(i18n.language)}
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(payment.paid_at).toLocaleString(i18n.language)}
        </div>
      </div>
      <Badge variant="secondary" className="shrink-0 font-normal">
        {t(`payment.${payment.method}`)}
      </Badge>
    </li>
  )
}

function PaymentsCard({ wash, style }: { wash: WashDetail; style?: CSSProperties }) {
  const { t, i18n } = useTranslation()

  const paid = isPaid(wash.price, wash.payments)
  const totalPaid = amountPaid(wash.payments)
  const rem = remaining(wash.price, wash.payments)
  const pct =
    wash.price > 0 ? Math.min(100, Math.round((totalPaid / wash.price) * 100)) : paid ? 100 : 0

  const nf = (n: number) => n.toLocaleString(i18n.language)

  return (
    <SectionCard
      icon={Banknote}
      title={t("washes.sectionPayments")}
      className="sm:col-span-2"
      style={style}
    >
      {/* Summary: paid / remaining + progress bar */}
      <div className="rounded-lg bg-muted/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold tabular-nums text-primary">{nf(totalPaid)}</span>
            <span className="text-sm text-muted-foreground">/ {nf(wash.price)}</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1",
              paid
                ? "border-green-200 bg-green-100 text-green-800"
                : "border-amber-200 bg-amber-100 text-amber-800",
            )}
          >
            {paid ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <XCircle className="h-3.5 w-3.5" aria-hidden />
            )}
            {paid ? t("wash.paid") : t("wash.unpaid")}
          </Badge>
        </div>
        {/* Slim teal progress bar */}
        <div
          className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {!paid && (
          <div className="mt-2 text-sm text-muted-foreground">
            {t("wash.remaining")}:{" "}
            <span className="font-semibold tabular-nums text-foreground">{nf(rem)}</span>
          </div>
        )}
      </div>

      {/* Payment list / empty state */}
      {wash.payments.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("washes.noPayments")}</p>
      ) : (
        <ul className="mt-1 divide-y">
          {wash.payments.map((p, i) => (
            <PaymentRow key={i} payment={p} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

// ─── Hero header ────────────────────────────────────────────────────────────

function HeroHeader({ wash }: { wash: WashDetail }) {
  const { t, i18n } = useTranslation()
  const queued = new Date(wash.created_at).toLocaleString(i18n.language)
  return (
    <Card className="cw-rise overflow-hidden border-s-4 border-s-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-sm">
      <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-5 sm:p-6">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
            {wash.plate_number ?? "—"}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
            <span className="tabular-nums">{queued}</span>
            {wash.branch_name && (
              <>
                <span aria-hidden className="text-muted-foreground/50">
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" aria-hidden />
                  {wash.branch_name}
                </span>
              </>
            )}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("shrink-0 px-3 py-1 text-sm", statusBadgeClass(wash.status))}
        >
          {t(`status.${wash.status}`)}
        </Badge>
      </CardContent>
    </Card>
  )
}

// ─── Loading skeleton (mirrors the real layout) ─────────────────────────────

function SkeletonSection({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-xl" />
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function LoadingState() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <div className="flex flex-col gap-4" role="status" aria-busy="true">
        <span className="sr-only">{t("common.loading")}</span>
        {/* Hero skeleton */}
        <Card className="overflow-hidden border-s-4 border-s-primary/30">
          <CardContent className="flex items-center justify-between gap-4 p-5 sm:p-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-44" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-7 w-24 rounded-full" />
          </CardContent>
        </Card>
        {/* Section skeletons */}
        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonSection rows={2} />
          <SkeletonSection rows={4} />
          <SkeletonSection rows={4} className="sm:col-span-2" />
          <SkeletonSection rows={3} className="sm:col-span-2" />
        </div>
      </div>
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function WashDetailPage() {
  const { t } = useTranslation()
  const { id = null } = useParams()

  const { data: wash, isLoading, isError } = useWash(id)

  if (isLoading) {
    return <LoadingState />
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <p role="alert" className="text-sm text-destructive">
          {t("washes.errors.generic")}
        </p>
      </div>
    )
  }

  if (!wash) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <p className="text-sm text-muted-foreground">{t("washes.notFound")}</p>
      </div>
    )
  }

  // Tasteful one-shot staggered entrance (cw-rise; no-op under reduced motion).
  const delay = (i: number): CSSProperties => ({ animationDelay: `${i * 60}ms` })

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <HeroHeader wash={wash} />

      <div className="grid gap-4 sm:grid-cols-2">
        <CustomerCard wash={wash} style={delay(1)} />
        <VehicleCard wash={wash} style={delay(2)} />
        <ServiceCard wash={wash} style={delay(3)} />
        <TimelineCard wash={wash} style={delay(4)} />
        <PaymentsCard wash={wash} style={delay(5)} />
      </div>
    </div>
  )
}
