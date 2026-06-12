import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { VehicleDialog } from "@/components/tenant/VehicleDialog"
import { listVehiclesByCustomer, removeVehicle, type Vehicle } from "@/lib/tenant/vehicles"
import type { Customer } from "@/lib/tenant/customers"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer
  onChanged: () => void
}

export function CustomerDetailDialog({ open, onOpenChange, customer, onChanged }: Props) {
  const { t } = useTranslation()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function fetchVehicles() {
    setLoading(true)
    setError(null)
    try {
      const data = await listVehiclesByCustomer(customer.id)
      setVehicles(data)
    } catch {
      setError(t("vehicles.errors.generic"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      void fetchVehicles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer.id])

  function handleAddVehicle() {
    setEditingVehicle(null)
    setVehicleDialogOpen(true)
  }

  function handleEditVehicle(vehicle: Vehicle) {
    setEditingVehicle(vehicle)
    setVehicleDialogOpen(true)
  }

  async function handleDeleteVehicle(vehicle: Vehicle) {
    if (!window.confirm(t("common.confirmDelete"))) return
    setDeletingId(vehicle.id)
    try {
      await removeVehicle(vehicle.id)
      await fetchVehicles()
      onChanged()
    } catch {
      setError(t("vehicles.errors.generic"))
    } finally {
      setDeletingId(null)
    }
  }

  function handleVehicleSaved() {
    void fetchVehicles()
    onChanged()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-full max-w-2xl mx-auto">
          <DialogHeader>
            <DialogTitle>{t("customers.detailTitle")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-base">{customer.name}</span>
              {customer.phone && (
                <span className="text-muted-foreground">{customer.phone}</span>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-sm">{t("vehicles.title")}</h2>
              <Button
                size="sm"
                onClick={handleAddVehicle}
                className="min-h-[44px]"
              >
                {t("vehicles.newVehicle")}
              </Button>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}

            {loading ? (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("vehicles.empty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
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
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditVehicle(vehicle)}
                              className="min-h-[44px]"
                            >
                              {t("common.edit")}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingId === vehicle.id}
                              onClick={() => handleDeleteVehicle(vehicle)}
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
    </>
  )
}
