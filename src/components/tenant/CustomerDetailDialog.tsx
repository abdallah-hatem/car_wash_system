import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { VehicleDialog } from "@/components/tenant/VehicleDialog"
import { RowsSkeleton } from "@/components/ui/skeletons"
import { useVehiclesByCustomer, useVehicleMutations } from "@/lib/tenant/queries"
import type { Vehicle } from "@/lib/tenant/vehicles"
import type { Customer } from "@/lib/tenant/customers"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer
  onChanged?: () => void
}

export function CustomerDetailDialog({ open, onOpenChange, customer, onChanged }: Props) {
  const { t } = useTranslation()

  const { data: vehicles = [], isLoading, isError } = useVehiclesByCustomer(open ? customer.id : null)
  const mutations = useVehicleMutations()

  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmVehicle, setConfirmVehicle] = useState<Vehicle | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleAddVehicle() {
    setEditingVehicle(null)
    setVehicleDialogOpen(true)
  }

  function handleEditVehicle(vehicle: Vehicle) {
    setEditingVehicle(vehicle)
    setVehicleDialogOpen(true)
  }

  function handleDeleteClick(vehicle: Vehicle) {
    setConfirmVehicle(vehicle)
    setDeleteError(null)
    setConfirmOpen(true)
  }

  async function handleDeleteConfirm() {
    if (!confirmVehicle) return
    setDeleteError(null)
    try {
      await mutations.remove.mutateAsync(confirmVehicle.id)
      onChanged?.()
      setConfirmOpen(false)
      setConfirmVehicle(null)
    } catch {
      setDeleteError(t("vehicles.errors.generic"))
      setConfirmOpen(false)
    }
  }

  function handleVehicleSaved() {
    onChanged?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-2xl mx-auto">
          <DialogHeader>
            <DialogTitle>{t("customers.detailTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2 min-w-0">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-base">{customer.name}</span>
              {customer.phone && (
                <span className="text-muted-foreground">{customer.phone}</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-sm">{t("vehicles.title")}</h2>
              <Button size="sm" onClick={handleAddVehicle} className="gap-1.5">
                <Plus className="h-4 w-4" />
                {t("vehicles.newVehicle")}
              </Button>
            </div>

            {deleteError && (
              <p role="alert" className="text-sm text-destructive">{deleteError}</p>
            )}

            {isError && (
              <p role="alert" className="text-sm text-destructive">{t("vehicles.errors.generic")}</p>
            )}

            {isLoading ? (
              <RowsSkeleton rows={3} />
            ) : vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("vehicles.empty")}</p>
            ) : (
              <div className="w-full min-w-0 overflow-x-auto rounded-md border">
                <Table>
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
                              disabled={mutations.remove.isPending && confirmVehicle?.id === vehicle.id}
                              onClick={() => handleDeleteClick(vehicle)}
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
          </div>
        </DialogContent>
      </Dialog>

      <VehicleDialog
        open={vehicleDialogOpen}
        onOpenChange={setVehicleDialogOpen}
        customerId={customer.id}
        vehicle={editingVehicle}
        onSaved={handleVehicleSaved}
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
    </>
  )
}
