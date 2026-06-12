import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { pagerInfo } from "@/lib/pagination"

export function Pager({ page, pageSize, total, onPageChange }: {
  page: number; pageSize: number; total: number; onPageChange: (p: number) => void
}) {
  const { t } = useTranslation()
  const info = pagerInfo(page, pageSize, total)
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap pt-2">
      <span className="text-sm text-muted-foreground">
        {t("pager.range", { from: info.fromItem, to: info.toItem, total: info.total })}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label={t("pager.prev")} title={t("pager.prev")}
          disabled={!info.hasPrev} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label={t("pager.next")} title={t("pager.next")}
          disabled={!info.hasNext} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  )
}
