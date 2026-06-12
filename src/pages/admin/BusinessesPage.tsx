import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Ban, CircleCheck, Plus } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CreateBusinessDialog } from "@/components/admin/CreateBusinessDialog"
import { useBusinesses, useBusinessMutations } from "@/lib/admin-queries"
import type { Business } from "@/lib/admin"

export default function BusinessesPage() {
  const { t, i18n } = useTranslation()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const { data: businesses = [], isLoading, isError } = useBusinesses()
  const { setStatus } = useBusinessMutations()

  async function handleToggleStatus(business: Business) {
    const nextStatus = business.status === "active" ? "suspended" : "active"
    setTogglingId(business.id)
    try {
      await setStatus.mutateAsync({ id: business.id, status: nextStatus })
    } catch {
      /* silently ignore — could show a toast in future */
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("admin.title")}</h1>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("admin.newBusiness")}
        </Button>
      </div>

      {/* Table area */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("admin.errors.generic")}
        </p>
      ) : businesses.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("admin.colName")}</TableHead>
                <TableHead className="text-start">{t("admin.colStatus")}</TableHead>
                <TableHead className="text-start">{t("admin.colCreated")}</TableHead>
                <TableHead className="text-start">{t("admin.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {businesses.map((biz) => (
                <TableRow key={biz.id}>
                  <TableCell className="font-medium">{biz.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={biz.status === "active" ? "default" : "secondary"}
                    >
                      {biz.status === "active"
                        ? t("admin.statusActive")
                        : t("admin.statusSuspended")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(biz.created_at).toLocaleDateString(i18n.language)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {biz.status === "active" ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={togglingId === biz.id}
                          onClick={() => handleToggleStatus(biz)}
                          aria-label={t("admin.suspend")}
                          title={t("admin.suspend")}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={togglingId === biz.id}
                          onClick={() => handleToggleStatus(biz)}
                          aria-label={t("admin.activate")}
                          title={t("admin.activate")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <CircleCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create business dialog */}
      <CreateBusinessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => setDialogOpen(false)}
      />
    </div>
  )
}
