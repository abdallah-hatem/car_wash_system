import { useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChevronLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CustomerDialog } from "@/components/tenant/CustomerDialog"
import { VehicleDialog } from "@/components/tenant/VehicleDialog"
import { PageSkeleton, RowsSkeleton, TableSkeleton } from "@/components/ui/skeletons"
import {
  useCustomer,
  useVehiclesByCustomer,
  useVehicleMutations,
  useCustomerMutations,
  useCustomerWashes,
} from "@/lib/tenant/queries"
import { isPaid } from "@/lib/tenant/operations"
import { statusBadgeClass } from "@/lib/tenant/status-style"
import type { Vehicle } from "@/lib/tenant/vehicles"

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/app/customers"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit min-h-[44px]"
    >
      <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
      {t("customers.back")}
    </Link>
  )
}

export default function CustomerDetailPage() {
  const { t, i18n } = useTranslation()
  const { id = null } = useParams()
  const navigate = useNavigate()

  const { data: customer, isLoading, isError } = useCustomer(id)

  const { data: vehicles = [], isLoading: vehiclesLoading, isError: vehiclesError } =
    useVehiclesByCustomer(id)
  const { data: washes = [], isLoading: washesLoading } = useCustomerWashes(id)

  const vehicleMutations = useVehicleMutations()
  const customerMutations = useCustomerMutations()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [confirmVehicleOpen, setConfirmVehicleOpen] = useState(false)
  const [confirmVehicle, setConfirmVehicle] = useState<Vehicle | null>(null)
  const [vehicleDeleteError, setVehicleDeleteError] = useState<string | null>(null)

  function handleAddVehicle() {
    setEditingVehicle(null)
    setVehicleDialogOpen(true)
  }

  function handleEditVehicle(vehicle: Vehicle) {
    setEditingVehicle(vehicle)
    setVehicleDialogOpen(true)
  }

  function handleDeleteVehicleClick(vehicle: Vehicle) {
    setConfirmVehicle(vehicle)
    setVehicleDeleteError(null)
    setConfirmVehicleOpen(true)
  }

  async function handleDeleteVehicleConfirm() {
    if (!confirmVehicle) return
    setVehicleDeleteError(null)
    try {
      await vehicleMutations.remove.mutateAsync(confirmVehicle.id)
      setConfirmVehicleOpen(false)
      setConfirmVehicle(null)
    } catch {
      setVehicleDeleteError(t("vehicles.errors.generic"))
      setConfirmVehicleOpen(false)
    }
  }

  async function handleDeleteCustomerConfirm() {
    if (!id) return
    setDeleteError(null)
    try {
      await customerMutations.remove.mutateAsync(id)
      setDeleteOpen(false)
      navigate("/app/customers")
    } catch {
      setDeleteError(t("customers.errors.generic"))
      setDeleteOpen(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <PageSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <p role="alert" className="text-sm text-destructive">
          {t("customers.errors.generic")}
        </p>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="flex flex-col gap-6">
        <BackLink />
        <p className="text-sm text-muted-foreground">{t("customers.notFound")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-xl font-semibold break-words">{customer.name}</h1>
          {customer.phone && (
            <span className="text-sm text-muted-foreground">{customer.phone}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5 min-h-[44px]">
            <Pencil className="h-4 w-4" />
            {t("common.edit")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setDeleteError(null); setDeleteOpen(true) }}
            className="gap-1.5 min-h-[44px] text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            {t("common.delete")}
          </Button>
        </div>
      </div>

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">{deleteError}</p>
      )}

      {/* Vehicles section */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{t("vehicles.title")}</h2>
          <Button size="sm" onClick={handleAddVehicle} className="gap-1.5 min-h-[44px]">
            <Plus className="h-4 w-4" />
            {t("vehicles.newVehicle")}
          </Button>
        </div>

        {vehicleDeleteError && (
          <p role="alert" className="text-sm text-destructive">{vehicleDeleteError}</p>
        )}

        {vehiclesError && (
          <p role="alert" className="text-sm text-destructive">{t("vehicles.errors.generic")}</p>
        )}

        {vehiclesLoading ? (
          <RowsSkeleton rows={3} />
        ) : vehicles.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("vehicles.empty")}</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto rounded-md border">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t("vehicles.plate")}</TableHead>
                  <TableHead className="text-start">{t("vehicles.make")}</TableHead>
                  <TableHead className="text-start">{t("vehicles.model")}</TableHead>
                  <TableHead className="text-start">{t("vehicles.color")}</TableHead>
                  <TableHead className="text-start">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-medium">{vehicle.plate_number}</TableCell>
                    <TableCell>{vehicle.make ?? "—"}</TableCell>
                    <TableCell>{vehicle.model ?? "—"}</TableCell>
                    <TableCell>{vehicle.color ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEditVehicle(vehicle)}
                          aria-label={t("common.edit")}
                          title={t("common.edit")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={vehicleMutations.remove.isPending && confirmVehicle?.id === vehicle.id}
                          onClick={() => handleDeleteVehicleClick(vehicle)}
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
      </section>

      {/* Wash history section */}
      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("customers.washHistory")}</h2>

        {washesLoading ? (
          <TableSkeleton columns={6} rows={3} minWidth="min-w-[640px]" />
        ) : washes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("customers.noWashes")}</p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto rounded-md border">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-start">{t("washes.colQueued")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPlate")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPackage")}</TableHead>
                  <TableHead className="text-start">{t("washes.colStatus")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPrice")}</TableHead>
                  <TableHead className="text-start">{t("washes.colPaid")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {washes.map((w) => {
                  const paid = isPaid(w.price, w.payments)
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(w.created_at).toLocaleDateString(i18n.language)}
                      </TableCell>
                      <TableCell className="text-sm">{w.plate_number ?? "—"}</TableCell>
                      <TableCell className="text-sm">{w.package_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(w.status)}>
                          {t(`status.${w.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{w.price}</TableCell>
                      <TableCell>
                        <Badge variant={paid ? "default" : "destructive"}>
                          {paid ? t("wash.paid") : t("wash.unpaid")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <CustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
      />

      <VehicleDialog
        open={vehicleDialogOpen}
        onOpenChange={setVehicleDialogOpen}
        customerId={customer.id}
        vehicle={editingVehicle}
      />

      <ConfirmDialog
        open={confirmVehicleOpen}
        onOpenChange={setConfirmVehicleOpen}
        title={t("common.confirmDeleteTitle")}
        description={t("common.confirmDeleteBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={vehicleMutations.remove.isPending}
        onConfirm={() => void handleDeleteVehicleConfirm()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("common.confirmDeleteTitle")}
        description={t("customers.deleteWarn")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={customerMutations.remove.isPending}
        onConfirm={() => void handleDeleteCustomerConfirm()}
      />
    </div>
  )
}
