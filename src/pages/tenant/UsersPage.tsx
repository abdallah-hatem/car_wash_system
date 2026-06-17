import { useState, useMemo } from "react"
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
import { TableSkeleton } from "@/components/ui/skeletons"
import { UserDialog } from "@/components/tenant/UserDialog"
import { useUsers, useUserMutations, useBranches } from "@/lib/tenant/queries"
import type { ManagedUser } from "@/lib/tenant/users"

export default function UsersPage() {
  const { t } = useTranslation()
  const { data: usersList, isLoading, isError, refetch } = useUsers()
  const { data: branches = [] } = useBranches()
  const rows: ManagedUser[] = usersList ?? []
  const mutations = useUserMutations()

  const branchName = useMemo(() => {
    const m = new Map(branches.map((b) => [b.id, b.name]))
    return (id: string) => m.get(id) ?? "—"
  }, [branches])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmUser, setConfirmUser] = useState<ManagedUser | null>(null)

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }
  function handleEdit(u: ManagedUser) {
    setEditing(u)
    setDialogOpen(true)
  }
  async function handleToggleActive(u: ManagedUser) {
    try {
      await mutations.setActive.mutateAsync({ userId: u.userId, isActive: !u.isActive })
    } catch {
      /* ignore */
    }
  }
  function handleDeleteClick(u: ManagedUser) {
    setConfirmUser(u)
    setConfirmOpen(true)
  }
  async function handleDeleteConfirm() {
    if (!confirmUser) return
    try {
      await mutations.remove.mutateAsync(confirmUser.userId)
    } catch {
      /* ignore */
    } finally {
      setConfirmOpen(false)
      setConfirmUser(null)
    }
  }

  const featureCount = (u: ManagedUser) =>
    Object.values(u.permissions).filter((lvl) => lvl && lvl !== "none").length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t("users.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("users.subtitle")}</p>
        </div>
        <Button onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("users.newUser")}
        </Button>
      </div>

      {isLoading ? (
        <TableSkeleton columns={5} />
      ) : isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{t("users.errors.generic")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("users.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("users.user")}</TableHead>
                <TableHead className="text-start">{t("users.branches")}</TableHead>
                <TableHead className="text-start">{t("users.access")}</TableHead>
                <TableHead className="text-start">{t("packages.status")}</TableHead>
                <TableHead className="text-start">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.userId}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{u.fullName || u.email}</span>
                      {u.fullName && (
                        <span className="text-xs font-normal text-muted-foreground">{u.email}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.branchIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground">{t("users.noBranches")}</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.branchIds.map((id) => (
                          <Badge key={id} variant="secondary" className="font-normal">
                            {branchName(id)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t("users.featureCount", { n: featureCount(u) })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "default" : "secondary"}>
                      {u.isActive ? t("users.active") : t("users.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="icon-sm" onClick={() => handleEdit(u)}
                        aria-label={t("common.edit")} title={t("common.edit")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon-sm"
                        disabled={mutations.setActive.isPending}
                        onClick={() => void handleToggleActive(u)}
                        aria-label={u.isActive ? t("common.deactivate") : t("common.activate")}
                        title={u.isActive ? t("common.deactivate") : t("common.activate")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {u.isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost" size="icon-sm"
                        disabled={mutations.remove.isPending && confirmUser?.userId === u.userId}
                        onClick={() => handleDeleteClick(u)}
                        aria-label={t("common.delete")} title={t("common.delete")}
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
      )}

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editing} />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("users.deleteTitle")}
        description={t("users.deleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={mutations.remove.isPending}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
