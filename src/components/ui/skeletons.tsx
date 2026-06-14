import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// Vary bar widths slightly for realism
const widths = ["w-3/4", "w-1/2", "w-2/3", "w-4/5", "w-3/5", "w-1/3"]
function barWidth(rowIdx: number, colIdx: number): string {
  return widths[(rowIdx * 3 + colIdx) % widths.length]
}

/**
 * TableSkeleton — mimics a table with a header row + N body rows of skeleton cells.
 * Renders inside a `rounded-md border` wrapper matching the real table containers.
 * Pass `minWidth` (e.g. "min-w-[1000px]") to match the real table's min-width so the
 * skeleton scrolls at the same breakpoint as the live table.
 */
export function TableSkeleton({
  columns,
  rows = 6,
  minWidth,
}: {
  columns: number
  rows?: number
  minWidth?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      className="overflow-x-auto rounded-md border"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <Table className={minWidth}>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <TableCell key={colIdx}>
                  <Skeleton className={cn("h-4", barWidth(rowIdx, colIdx))} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * CardGridSkeleton — a grid of skeleton cards for the queue board loading state.
 */
export function CardGridSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      className={cn("grid grid-cols-1 lg:grid-cols-3 gap-4", className)}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-md border p-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-full mt-2" />
        </div>
      ))}
    </div>
  )
}

/**
 * StatCardsSkeleton — a responsive grid of skeleton stat-cards matching DashboardPage's layout.
 */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  const { t } = useTranslation()
  return (
    <div
      className="flex flex-col gap-4"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16 mt-1" />
            </div>
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * RowsSkeleton — simple stacked skeleton lines (dialog vehicle list / small areas).
 */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation()
  return (
    <div
      className="flex flex-col gap-2"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i % 2 === 0 ? "w-3/4" : "w-1/2")} />
      ))}
    </div>
  )
}

/**
 * PageSkeleton — a simple full-page loading placeholder (title bar + content block).
 */
export function PageSkeleton() {
  const { t } = useTranslation()
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
      <Skeleton className="h-48 w-full rounded-md" />
    </div>
  )
}
