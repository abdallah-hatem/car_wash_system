import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Check, Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/auth/AuthProvider"
import { createVehicle, updateVehicle, type Vehicle } from "@/lib/tenant/vehicles"
import { validateEgyptianPlate } from "@/lib/tenant/validators"
import { PlateInput, type PlateValue } from "@/components/tenant/PlateInput"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerId: string
  vehicle?: Vehicle | null
  onSaved: () => void
}

export function VehicleDialog({ open, onOpenChange, customerId, vehicle, onSaved }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()

  const [plate, setPlate] = useState<PlateValue>({ letters: "", digits: "" })
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [color, setColor] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPlate({
        letters: vehicle?.plate_letters ?? "",
        digits: vehicle?.plate_digits ?? "",
      })
      setMake(vehicle?.make ?? "")
      setModel(vehicle?.model ?? "")
      setColor(vehicle?.color ?? "")
      setFieldError(null)
    }
  }, [open, vehicle])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setPlate({ letters: "", digits: "" })
      setMake("")
      setModel("")
      setColor("")
      setFieldError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const validationCode = validateEgyptianPlate(plate)
    if (validationCode) {
      setFieldError(t(`validation.${validationCode}`))
      return
    }

    if (!vehicle && !claims.tenantId) {
      setFieldError(t("vehicles.errors.generic"))
      return
    }

    setSubmitting(true)
    try {
      if (vehicle) {
        await updateVehicle(vehicle.id, {
          plate_letters: plate.letters,
          plate_digits: plate.digits,
          make: make || null,
          model: model || null,
          color: color || null,
        })
      } else {
        await createVehicle(claims.tenantId!, {
          customer_id: customerId,
          plate_letters: plate.letters,
          plate_digits: plate.digits,
          make: make || null,
          model: model || null,
          color: color || null,
        })
      }
      handleOpenChange(false)
      onSaved()
    } catch (err) {
      if (err instanceof Error && err.message === "duplicate") {
        setFieldError(t("vehicles.errors.duplicate"))
      } else {
        setFieldError(t("vehicles.errors.generic"))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>
              {vehicle ? t("common.edit") : t("vehicles.newVehicle")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <PlateInput value={plate} onChange={setPlate} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-make">
                {t("vehicles.make")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="vehicle-make"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-model">
                {t("vehicles.model")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="vehicle-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vehicle-color">
                {t("vehicles.color")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="vehicle-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            {fieldError && (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {!submitting && (vehicle ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {submitting ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
