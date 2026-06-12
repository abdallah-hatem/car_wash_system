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
import { EmployeeDialog } from "@/components/tenant/EmployeeDialog"
import { useEmployees, useBranches, useEmployeeMutations } from "@/lib/tenant/queries"
import type { Employee } from "@/lib/tenant/employees"

export default function StaffPage() {
  const { t } = useTranslation()

  const { data: employees = [], isLoading, isError, refetch } = useEmployees()
  const { data: branches = [] } = useBranches()
  const mutations = useEmployeeMutations()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmEmployee, setConfirmEmployee] = useState<Employee | null>(null)

  function getBranchName(branchId: string | null): string {
    if (!branchId) return "—"
    return branches.find((b) => b.id === branchId)?.name ?? "—"
  }

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(employee: Employee) {
    setEditing(employee)
    setDialogOpen(true)
  }

  async function handleToggleActive(employee: Employee) {
    try {
      await mutations.setActive.mutateAsync({ id: employee.id, is_active: !employee.is_active })
    } catch {
      /* silently ignore */
    }
  }

  function handleDeleteClick(employee: Employee) {
    setConfirmEmployee(employee)
    setConfirmOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!confirmEmployee) return
    try {
      await mutations.remove.mutateAsync(confirmEmployee.id)
    } catch {
      /* could show toast in future */
    } finally {
      setConfirmOpen(false)
      setConfirmEmployee(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("staff.title")}</h1>
        <Button onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("staff.newEmployee")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{t("staff.errors.generic")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : employees.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("staff.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("staff.name")}</TableHead>
                <TableHead className="text-start">{t("staff.phone")}</TableHead>
                <TableHead className="text-start">{t("staff.branch")}</TableHead>
                <TableHead className="text-start">{t("staff.status")}</TableHead>
                <TableHead className="text-start">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">{employee.name}</TableCell>
                  <TableCell>{employee.phone ?? "—"}</TableCell>
                  <TableCell>{getBranchName(employee.branch_id)}</TableCell>
                  <TableCell>
                    <Badge variant={employee.is_active ? "default" : "secondary"}>
                      {employee.is_active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(employee)}
                        aria-label={t("common.edit")}
                        title={t("common.edit")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {employee.is_active ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={mutations.setActive.isPending}
                          onClick={() => void handleToggleActive(employee)}
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
                          disabled={mutations.setActive.isPending}
                          onClick={() => void handleToggleActive(employee)}
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
                        disabled={mutations.remove.isPending && confirmEmployee?.id === employee.id}
                        onClick={() => handleDeleteClick(employee)}
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
      )}

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
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
