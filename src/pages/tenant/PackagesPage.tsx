import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Plus, Power, PowerOff, Trash2 } from "lucide-react"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Pager } from "@/components/ui/pager"
import { TableSkeleton } from "@/components/ui/skeletons"
import { PackageDialog } from "@/components/tenant/PackageDialog"
import { usePackagesPaged, usePackageMutations } from "@/lib/tenant/queries"
import { PAGE_SIZE } from "@/lib/pagination"
import type { Package } from "@/lib/tenant/packages"
import { useAuth } from "@/auth/AuthProvider"
import { canEdit } from "@/auth/claims"

export default function PackagesPage() {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const allowEdit = canEdit(claims, "packages")

  const [page, setPage] = useState(0)
  const { data, isLoading, isError, refetch } = usePackagesPaged(page)
  const rows: Package[] = data?.rows ?? []
  const total = data?.total ?? 0

  const mutations = usePackageMutations()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Package | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmPkg, setConfirmPkg] = useState<Package | null>(null)

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(pkg: Package) {
    setEditing(pkg)
    setDialogOpen(true)
  }

  async function handleToggleActive(pkg: Package) {
    try {
      await mutations.setActive.mutateAsync({ id: pkg.id, is_active: !pkg.is_active })
    } catch {
      /* silently ignore */
    }
  }

  function handleDeleteClick(pkg: Package) {
    setConfirmPkg(pkg)
    setConfirmOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!confirmPkg) return
    try {
      await mutations.remove.mutateAsync(confirmPkg.id)
      if (rows.length === 1 && page > 0) setPage(page - 1)
    } catch {
      /* could show toast in future */
    } finally {
      setConfirmOpen(false)
      setConfirmPkg(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("packages.title")}</h1>
        <Button onClick={handleNew} disabled={!allowEdit} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("packages.newPackage")}
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{t("packages.errors.generic")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("packages.empty")}</p>
      ) : (
        <>
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
                {rows.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{pkg.name}</span>
                        {pkg.description && (
                          <span className="line-clamp-1 max-w-[32ch] text-xs font-normal text-muted-foreground">
                            {pkg.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
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
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={!allowEdit}
                          onClick={() => handleEdit(pkg)}
                          aria-label={t("common.edit")}
                          title={t("common.edit")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {pkg.is_active ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={mutations.setActive.isPending || !allowEdit}
                            onClick={() => void handleToggleActive(pkg)}
                            aria-label={t("common.deactivate")}
                            title={t("common.deactivate")}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <PowerOff className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={mutations.setActive.isPending || !allowEdit}
                            onClick={() => void handleToggleActive(pkg)}
                            aria-label={t("common.activate")}
                            title={t("common.activate")}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={(mutations.remove.isPending && confirmPkg?.id === pkg.id) || !allowEdit}
                          onClick={() => handleDeleteClick(pkg)}
                          aria-label={t("common.delete")}
                          title={t("common.delete")}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}

      <PackageDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pkg={editing}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("common.confirmDeleteTitle")}
        description={t("common.confirmDeleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={mutations.remove.isPending}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
