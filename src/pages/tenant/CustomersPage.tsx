import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Car, Pencil, Plus, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Pager } from "@/components/ui/pager"
import { CustomerDialog } from "@/components/tenant/CustomerDialog"
import { CustomerDetailDialog } from "@/components/tenant/CustomerDetailDialog"
import { CustomerSearch } from "@/components/tenant/CustomerSearch"
import { useCustomersPaged, useCustomerMutations } from "@/lib/tenant/queries"
import { PAGE_SIZE } from "@/lib/pagination"
import type { Customer } from "@/lib/tenant/customers"
import type { CustomerMatch } from "@/lib/tenant/customer-search"

export default function CustomersPage() {
  const { t } = useTranslation()

  const [page, setPage] = useState(0)
  const { data, isLoading, isError, refetch } = useCustomersPaged(page)
  const rows: Customer[] = data?.rows ?? []
  const total = data?.total ?? 0

  const mutations = useCustomerMutations()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmCustomer, setConfirmCustomer] = useState<Customer | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(customer: Customer) {
    setEditing(customer)
    setDialogOpen(true)
  }

  function handleManage(customer: Customer) {
    setDetailCustomer(customer)
    setDetailOpen(true)
  }

  function openDetailForCustomerMatch(match: CustomerMatch) {
    // Try to find the full Customer from the current page (includes vehicle_count).
    // If not on this page, build a minimal Customer stub from the search match.
    const found = rows.find((c) => c.id === match.id)
    const customer: Customer = found ?? {
      id: match.id,
      name: match.name,
      phone: match.phone,
      created_at: "",
      vehicle_count: 0,
    }
    setDetailCustomer(customer)
    setDetailOpen(true)
  }

  function handleDeleteClick(customer: Customer) {
    setConfirmCustomer(customer)
    setDeleteError(null)
    setConfirmOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!confirmCustomer) return
    setDeleteError(null)
    try {
      await mutations.remove.mutateAsync(confirmCustomer.id)
      if (rows.length === 1 && page > 0) setPage(page - 1)
      setConfirmOpen(false)
      setConfirmCustomer(null)
    } catch {
      setDeleteError(t("customers.errors.generic"))
      setConfirmOpen(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("customers.title")}</h1>
        <Button onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("customers.newCustomer")}
        </Button>
      </div>

      <CustomerSearch onOpenCustomer={openDetailForCustomerMatch} />

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">{deleteError}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{t("customers.errors.generic")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("customers.empty")}</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t("customers.name")}</TableHead>
                  <TableHead className="text-start">{t("customers.phone")}</TableHead>
                  <TableHead className="text-start">{t("customers.vehicleCount")}</TableHead>
                  <TableHead className="text-start">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.phone ?? "—"}</TableCell>
                    <TableCell>{customer.vehicle_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleManage(customer)}
                          aria-label={t("vehicles.title")}
                          title={t("vehicles.title")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Car className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(customer)}
                          aria-label={t("common.edit")}
                          title={t("common.edit")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={mutations.remove.isPending && confirmCustomer?.id === customer.id}
                          onClick={() => handleDeleteClick(customer)}
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

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editing}
      />

      {detailCustomer && (
        <CustomerDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          customer={detailCustomer}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("common.confirmDeleteTitle")}
        description={t("customers.deleteWarn")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={mutations.remove.isPending}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </div>
  )
}
