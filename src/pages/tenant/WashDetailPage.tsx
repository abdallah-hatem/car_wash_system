import { useParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageSkeleton } from "@/components/ui/skeletons"
import { useWash } from "@/lib/tenant/queries"
import { statusBadgeClass } from "@/lib/tenant/status-style"
import { isPaid, amountPaid, remaining } from "@/lib/tenant/operations"
import { diffMinutes, formatDuration } from "@/lib/tenant/duration"

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/app/washes"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit min-h-[44px]"
    >
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      {t("washes.back")}
    </Link>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4 flex flex-col gap-3">
      <h2 className="font-semibold text-base">{title}</h2>
      {children}
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <span className="text-muted-foreground shrink-0 min-w-[120px]">{label}</span>
      <span className="font-medium break-words">{value ?? "—"}</span>
    </div>
  )
}

export default function WashDetailPage() {
  const { t, i18n } = useTranslation()
  const { id = null } = useParams()

  const { data: wash, isLoading, isError } = useWash(id)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <PageSkeleton />
      </div>
    )
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

  const paid = isPaid(wash.price, wash.payments)
  const totalPaid = amountPaid(wash.payments)
  const rem = remaining(wash.price, wash.payments)
  const wait = formatDuration(diffMinutes(wash.created_at, wash.started_at))
  const serviceDur = formatDuration(diffMinutes(wash.started_at, wash.completed_at))

  function fmtDate(iso: string | null): string {
    if (!iso) return "—"
    return new Date(iso).toLocaleString(i18n.language)
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      {/* Header: plate + status badge */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold break-words">
          {wash.plate_number ?? "—"}
        </h1>
        <Badge variant="outline" className={statusBadgeClass(wash.status)}>
          {t(`status.${wash.status}`)}
        </Badge>
      </div>

      {/* Customer section */}
      <SectionCard title={t("washes.sectionCustomer")}>
        <DetailRow
          label={t("customers.name")}
          value={
            wash.customer_id && wash.customer_name ? (
              <Link
                to={`/app/customers/${wash.customer_id}`}
                className="hover:underline text-foreground"
              >
                {wash.customer_name}
              </Link>
            ) : (
              wash.customer_name ?? "—"
            )
          }
        />
        {wash.customer_phone && (
          <DetailRow label={t("customers.phone")} value={wash.customer_phone} />
        )}
      </SectionCard>

      {/* Vehicle section */}
      <SectionCard title={t("washes.sectionVehicle")}>
        <DetailRow label={t("wash.plate")} value={wash.plate_number} />
        <DetailRow label={t("vehicles.make")} value={wash.vehicle_make} />
        <DetailRow label={t("vehicles.model")} value={wash.vehicle_model} />
        <DetailRow label={t("vehicles.color")} value={wash.vehicle_color} />
      </SectionCard>

      {/* Service section */}
      <SectionCard title={t("washes.sectionService")}>
        <DetailRow label={t("wash.package")} value={wash.package_name} />
        <DetailRow label={t("wash.price")} value={wash.price} />
        <DetailRow label={t("wash.assignedTo")} value={wash.employee_name} />
        <DetailRow label={t("washes.colBranch")} value={wash.branch_name} />
        {wash.notes && (
          <DetailRow label={t("wash.notes")} value={wash.notes} />
        )}
      </SectionCard>

      {/* Timeline section */}
      <SectionCard title={t("washes.sectionTimeline")}>
        <DetailRow label={t("washes.queued")} value={fmtDate(wash.created_at)} />
        <DetailRow label={t("washes.started")} value={fmtDate(wash.started_at)} />
        {wash.status === "cancelled" ? (
          <>
            <DetailRow label={t("washes.cancelledAt")} value={fmtDate(wash.cancelled_at)} />
            {wash.cancellation_reason && (
              <DetailRow label={t("washes.colReason")} value={wash.cancellation_reason} />
            )}
          </>
        ) : (
          <DetailRow label={t("washes.completed")} value={fmtDate(wash.completed_at)} />
        )}
        <DetailRow label={t("washes.waitDuration")} value={wait} />
        <DetailRow label={t("washes.serviceDuration")} value={serviceDur} />
      </SectionCard>

      {/* Payments section */}
      <SectionCard title={t("washes.sectionPayments")}>
        {wash.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("washes.noPayments")}</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t("payment.amount")}</TableHead>
                  <TableHead className="text-start">{t("payment.method")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPaidAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wash.payments.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.amount}</TableCell>
                    <TableCell>{t(`payment.${p.method}`)}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(p.paid_at).toLocaleString(i18n.language)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary row */}
        <div className="flex flex-wrap gap-4 text-sm pt-2 border-t">
          <span className="text-muted-foreground">
            {t("washes.totalPaid")}:{" "}
            <span className="font-medium text-foreground">{totalPaid}</span>
          </span>
          {!paid && (
            <span className="text-muted-foreground">
              {t("wash.remaining")}:{" "}
              <span className="font-medium text-destructive">{rem}</span>
            </span>
          )}
          <Badge variant={paid ? "default" : "destructive"}>
            {paid ? t("wash.paid") : t("wash.unpaid")}
          </Badge>
        </div>
      </SectionCard>
    </div>
  )
}
