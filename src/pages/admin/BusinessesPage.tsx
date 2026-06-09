import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { listBusinesses, setBusinessStatus, type Business } from "@/lib/admin"

export default function BusinessesPage() {
  const { t, i18n } = useTranslation()

  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  async function fetchBusinesses() {
    setLoading(true)
    setError(null)
    try {
      const data = await listBusinesses()
      setBusinesses(data)
    } catch {
      setError(t("admin.errors.generic"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchBusinesses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleToggleStatus(business: Business) {
    const nextStatus = business.status === "active" ? "suspended" : "active"
    setTogglingId(business.id)
    try {
      await setBusinessStatus(business.id, nextStatus)
      await fetchBusinesses()
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
        <Button
          onClick={() => setDialogOpen(true)}
          className="min-h-[44px]"
        >
          {t("admin.newBusiness")}
        </Button>
      </div>

      {/* Table area */}
      {loading ? (
        <p className="text-sm text-muted-foreground">{t("admin.loading")}</p>
      ) : error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
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
                    <Button
                      variant={biz.status === "active" ? "destructive" : "outline"}
                      size="sm"
                      disabled={togglingId === biz.id}
                      onClick={() => handleToggleStatus(biz)}
                      className="min-h-[44px]"
                    >
                      {biz.status === "active"
                        ? t("admin.suspend")
                        : t("admin.activate")}
                    </Button>
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
        onCreated={fetchBusinesses}
      />
    </div>
  )
}
