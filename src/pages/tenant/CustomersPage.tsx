import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Pager } from "@/components/ui/pager"
import { TableSkeleton } from "@/components/ui/skeletons"
import { CustomerDialog } from "@/components/tenant/CustomerDialog"
import { useCustomersPaged, useCustomerMutations } from "@/lib/tenant/queries"
import { PAGE_SIZE } from "@/lib/pagination"
import type { Customer } from "@/lib/tenant/customers"

export default function CustomersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce search into debouncedSearch (300 ms)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    const trimmed = search.trim()
    if (!trimmed) {
      setDebouncedSearch("")
      return
    }
    timerRef.current = setTimeout(() => {
      setDebouncedSearch(trimmed)
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [search])

  // Reset page to 0 when debounced search changes
  useEffect(() => {
    setPage(0)
  }, [debouncedSearch])

  const { data, isLoading, isError, refetch, isPlaceholderData } = useCustomersPaged(page, debouncedSearch)
  const rows: Customer[] = data?.rows ?? []
  const total = data?.total ?? 0

  const mutations = useCustomerMutations()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmCustomer, setConfirmCustomer] = useState<Customer | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(customer: Customer) {
    setEditing(customer)
    setDialogOpen(true)
  }

  function handleManage(customer: Customer) {
    navigate(`/app/customers/${customer.id}`)
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

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="customer-filter"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
          placeholder={t("customerSearch.placeholder")}
          className="min-h-[44px] ps-9"
          autoComplete="off"
        />
      </div>

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">{deleteError}</p>
      )}

      {isLoading ? (
        <TableSkeleton columns={4} minWidth="min-w-[640px]" />
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
          <div
            className={`overflow-x-auto rounded-md border transition-opacity duration-200 ${
              isPlaceholderData ? "opacity-60" : "opacity-100"
            }`}
          >
            <Table className="min-w-[640px]">
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
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => handleManage(customer)}
                        className="text-start hover:underline focus-visible:underline outline-none"
                      >
                        {customer.name}
                      </button>
                    </TableCell>
                    <TableCell>{customer.phone ?? "—"}</TableCell>
                    <TableCell>{customer.vehicle_count}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleManage(customer)}
                          aria-label={t("common.view")}
                          title={t("common.view")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
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
