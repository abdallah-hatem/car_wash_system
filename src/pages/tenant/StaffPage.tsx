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
import { EmployeeDialog } from "@/components/tenant/EmployeeDialog"
import { listEmployees, removeEmployee, setEmployeeActive, type Employee } from "@/lib/tenant/employees"
import { listBranches, type Branch } from "@/lib/tenant/branches"

export default function StaffPage() {
  const { t } = useTranslation()

  const [employees, setEmployees] = useState<Employee[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)
    setError(null)
    try {
      const [empData, branchData] = await Promise.all([listEmployees(), listBranches()])
      setEmployees(empData)
      setBranches(branchData)
    } catch {
      setError(t("staff.errors.generic"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    setTogglingId(employee.id)
    try {
      await setEmployeeActive(employee.id, !employee.is_active)
      await fetchData()
    } catch {
      /* silently ignore */
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(employee: Employee) {
    if (!window.confirm(t("common.confirmDelete"))) return
    setDeletingId(employee.id)
    try {
      await removeEmployee(employee.id)
      await fetchData()
    } catch {
      /* could show toast in future */
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("staff.title")}</h1>
        <Button onClick={handleNew} className="min-h-[44px]">
          {t("staff.newEmployee")}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="min-h-[44px] w-fit">
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(employee)}
                        className="min-h-[44px]"
                      >
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={togglingId === employee.id}
                        onClick={() => handleToggleActive(employee)}
                        className="min-h-[44px]"
                      >
                        {employee.is_active ? t("common.deactivate") : t("common.activate")}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deletingId === employee.id}
                        onClick={() => handleDelete(employee)}
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

      <EmployeeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={editing}
        onSaved={fetchData}
      />
    </div>
  )
}
