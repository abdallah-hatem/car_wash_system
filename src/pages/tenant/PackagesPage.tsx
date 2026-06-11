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
import { PackageDialog } from "@/components/tenant/PackageDialog"
import { listPackages, removePackage, setPackageActive, type Package } from "@/lib/tenant/packages"

export default function PackagesPage() {
  const { t } = useTranslation()

  const [packages, setPackages] = useState<Package[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Package | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchPackages() {
    setLoading(true)
    setError(null)
    try {
      const data = await listPackages()
      setPackages(data)
    } catch {
      setError(t("packages.errors.generic"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchPackages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(pkg: Package) {
    setEditing(pkg)
    setDialogOpen(true)
  }

  async function handleToggleActive(pkg: Package) {
    setTogglingId(pkg.id)
    try {
      await setPackageActive(pkg.id, !pkg.is_active)
      await fetchPackages()
    } catch {
      /* silently ignore */
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(pkg: Package) {
    if (!window.confirm(t("common.confirmDelete"))) return
    setDeletingId(pkg.id)
    try {
      await removePackage(pkg.id)
      await fetchPackages()
    } catch {
      /* could show toast in future */
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("packages.title")}</h1>
        <Button onClick={handleNew} className="min-h-[44px]">
          {t("packages.newPackage")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPackages} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : packages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("packages.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("packages.name")}</TableHead>
                <TableHead className="text-start">{t("packages.price")}</TableHead>
                <TableHead className="text-start">{t("packages.duration")}</TableHead>
                <TableHead className="text-start">{t("packages.status")}</TableHead>
                <TableHead className="text-start">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>{pkg.price}</TableCell>
                  <TableCell>
                    {pkg.duration_minutes != null
                      ? `${pkg.duration_minutes} ${t("packages.minutes")}`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(pkg)}
                        className="min-h-[44px]"
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={togglingId === pkg.id}
                        onClick={() => handleToggleActive(pkg)}
                        className="min-h-[44px]"
                      >
                        {pkg.is_active ? t("common.deactivate") : t("common.activate")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === pkg.id}
                        onClick={() => handleDelete(pkg)}
                        className="min-h-[44px]"
                      >
                        {t("common.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PackageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pkg={editing}
        onSaved={fetchPackages}
      />
    </div>
  )
}
