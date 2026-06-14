import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pager } from "@/components/ui/pager"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useBranch } from "@/lib/tenant/branch-context"
import { useWashes, useBranches, useEmployees } from "@/lib/tenant/queries"
import { isPaid } from "@/lib/tenant/operations"
import { diffMinutes, formatDuration, defaultDateRange } from "@/lib/tenant/duration"
import { PAGE_SIZE } from "@/lib/pagination"
import type { WashFilters } from "@/lib/tenant/washes"
import type { WashStatus } from "@/lib/tenant/operations"
import { DateRangePicker } from "@/components/tenant/DateRangePicker"
import { TableSkeleton } from "@/components/ui/skeletons"

const STATUSES: WashStatus[] = ["waiting", "in_progress", "done", "cancelled"]

const statusVariant: Record<WashStatus, "default" | "secondary" | "destructive" | "outline"> = {
  waiting: "secondary",
  in_progress: "default",
  done: "outline",
  cancelled: "destructive",
}

export default function WashesPage() {
  const { t, i18n } = useTranslation()
  const { branchId } = useBranch()

  const defaults = defaultDateRange(new Date())

  const [plateInput, setPlateInput] = useState("")
  const [filters, setFilters] = useState<WashFilters>({
    branchId: branchId ?? "all",
    status: "all",
    employeeId: "all",
    from: defaults.from,
    to: defaults.to,
    plate: "",
  })

  const [page, setPage] = useState(0)

  // Debounce the plate input 300 ms before committing to filters
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(0)
      setFilters((prev) => ({ ...prev, plate: plateInput }))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [plateInput])
  const { data: washData = { rows: [], total: 0 }, isLoading, isError, refetch } = useWashes(filters, page)
  const rows = washData.rows
  const total = washData.total
  const { data: branches = [] } = useBranches()
  const { data: employees = [] } = useEmployees()

  const activeEmployees = employees.filter((e) => e.is_active)

  function setFilter<K extends keyof WashFilters>(key: K, value: WashFilters[K]) {
    setPage(0)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <h1 className="text-2xl font-bold">{t("washes.title")}</h1>

      {/* Filter bar — wraps on small screens */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Date range picker */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">
            {t("washes.dateRange")}
          </label>
          <DateRangePicker
            from={filters.from}
            to={filters.to}
            onChange={(from, to) => {
              setPage(0)
              setFilters((prev) => ({ ...prev, from, to }))
            }}
          />
        </div>

        {/* Status filter */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">{t("washes.status")}</label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilter("status", v as WashStatus | "all")}
          >
            <SelectTrigger className="min-h-[44px] min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("washes.allStatuses")}</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Employee filter */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">{t("washes.employee")}</label>
          <Select
            value={filters.employeeId}
            onValueChange={(v) => setFilter("employeeId", v)}
          >
            <SelectTrigger className="min-h-[44px] min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("washes.allEmployees")}</SelectItem>
              {activeEmployees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Branch filter */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">{t("washes.branch")}</label>
          <Select
            value={filters.branchId}
            onValueChange={(v) => setFilter("branchId", v)}
          >
            <SelectTrigger className="min-h-[44px] min-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("washes.allBranches")}</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Plate search */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-muted-foreground">{t("washes.colPlate")}</label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={plateInput}
              onChange={(e) => setPlateInput(e.target.value)}
              placeholder={t("washes.platePlaceholder")}
              className="min-h-[44px] min-w-[180px] ps-9"
            />
          </div>
        </div>
      </div>

      {/* States */}
      {isLoading ? (
        <TableSkeleton columns={12} />
      ) : isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{t("washes.errors.generic")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("washes.empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t("washes.colQueued")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPlate")}</TableHead>
                  <TableHead className="text-start">{t("washes.colCustomer")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPackage")}</TableHead>
                  <TableHead className="text-start">{t("washes.colBranch")}</TableHead>
                  <TableHead className="text-start">{t("washes.colStatus")}</TableHead>
                  <TableHead className="text-start">{t("washes.colEmployee")}</TableHead>
                  <TableHead className="text-start">{t("washes.colWait")}</TableHead>
                  <TableHead className="text-start">{t("washes.colService")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPrice")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPaid")}</TableHead>
                  <TableHead className="text-start">{t("washes.colReason")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const paid = isPaid(row.price, row.payments)
                  const wait = formatDuration(diffMinutes(row.created_at, row.started_at))
                  const service = formatDuration(diffMinutes(row.started_at, row.completed_at))
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(row.created_at).toLocaleString(i18n.language)}
                      </TableCell>
                      <TableCell>{row.plate_number ?? "—"}</TableCell>
                      <TableCell>{row.customer_name ?? "—"}</TableCell>
                      <TableCell>{row.package_name ?? "—"}</TableCell>
                      <TableCell>{row.branch_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[row.status] ?? "secondary"}>
                          {t(`status.${row.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.employee_name ?? "—"}</TableCell>
                      <TableCell>{wait}</TableCell>
                      <TableCell>{service}</TableCell>
                      <TableCell>{row.price}</TableCell>
                      <TableCell>
                        <Badge variant={paid ? "default" : "destructive"}>
                          {paid ? t("wash.paid") : t("wash.unpaid")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {row.cancellation_reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </div>
  )
}
