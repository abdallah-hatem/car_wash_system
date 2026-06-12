import { useEffect, useState, useCallback } from "react"
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
import { CustomerDialog } from "@/components/tenant/CustomerDialog"
import { CustomerDetailDialog } from "@/components/tenant/CustomerDetailDialog"
import { PlateSearch } from "@/components/tenant/PlateSearch"
import { listCustomers, removeCustomer, type Customer } from "@/lib/tenant/customers"

export default function CustomersPage() {
  const { t } = useTranslation()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null)

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listCustomers()
      setCustomers(data)
    } catch {
      setError(t("customers.errors.generic"))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void fetchCustomers()
  }, [fetchCustomers])

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

  function openDetailForCustomerId(id: string) {
    const found = customers.find((c) => c.id === id)
    if (found) {
      setDetailCustomer(found)
      setDetailOpen(true)
    }
  }

  async function handleDelete(customer: Customer) {
    if (!window.confirm(t("customers.deleteWarn"))) return
    setDeletingId(customer.id)
    setDeleteError(null)
    try {
      await removeCustomer(customer.id)
      await fetchCustomers()
    } catch {
      setDeleteError(t("customers.errors.generic"))
    } finally {
      setDeletingId(null)
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

      <PlateSearch onOpenCustomer={openDetailForCustomerId} />

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">{deleteError}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchCustomers} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : customers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("customers.empty")}</p>
      ) : (
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
              {customers.map((customer) => (
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
                        disabled={deletingId === customer.id}
                        onClick={() => handleDelete(customer)}
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

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editing}
        onSaved={fetchCustomers}
      />

      {detailCustomer && (
        <CustomerDetailDialog
          open={detailOpen}
          onOpenChange={setDetailOpen}
          customer={detailCustomer}
          onChanged={fetchCustomers}
        />
      )}
    </div>
  )
}
