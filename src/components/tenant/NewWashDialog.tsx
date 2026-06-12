import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/auth/AuthProvider"
import { searchVehiclesByPlate, createVehicle, type PlateMatch } from "@/lib/tenant/vehicles"
import { createCustomer } from "@/lib/tenant/customers"
import { listPackages, type Package } from "@/lib/tenant/packages"
import { createWashOrder } from "@/lib/tenant/wash-orders"
import { validateNewWash } from "@/lib/tenant/operations"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  branchId: string
  onCreated: () => void
}

export function NewWashDialog({ open, onOpenChange, branchId, onCreated }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()

  // Vehicle / plate state
  const [plateTerm, setPlateTerm] = useState("")
  const [plateResults, setPlateResults] = useState<PlateMatch[]>([])
  const [plateSearching, setPlateSearching] = useState(false)
  const [selectedVehicle, setSelectedVehicle] = useState<PlateMatch | null>(null)

  // New vehicle details (shown when user doesn't pick from search)
  const [showDetails, setShowDetails] = useState(false)
  const [make, setMake] = useState("")
  const [model, setModel] = useState("")
  const [color, setColor] = useState("")

  // Quick customer
  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")

  // Package + price + notes
  const [packages, setPackages] = useState<Package[]>([])
  const [packageId, setPackageId] = useState("")
  const [price, setPrice] = useState("")
  const [notes, setNotes] = useState("")

  // UI state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load active packages when dialog opens
  useEffect(() => {
    if (!open) return
    listPackages()
      .then((all) => setPackages(all.filter((p) => p.is_active)))
      .catch(() => setPackages([]))
  }, [open])

  // Plate search with debounce
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    const trimmed = plateTerm.trim()
    if (!trimmed || selectedVehicle) {
      setPlateResults([])
      setPlateSearching(false)
      return
    }

    setPlateSearching(true)
    let active = true

    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchVehiclesByPlate(trimmed)
        if (!active) return
        setPlateResults(data)
      } catch {
        if (!active) return
        setPlateResults([])
      } finally {
        if (active) setPlateSearching(false)
      }
    }, 300)

    return () => {
      active = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [plateTerm, selectedVehicle])

  function resetForm() {
    setPlateTerm("")
    setPlateResults([])
    setPlateSearching(false)
    setSelectedVehicle(null)
    setShowDetails(false)
    setMake("")
    setModel("")
    setColor("")
    setCustomerName("")
    setCustomerPhone("")
    setPackageId("")
    setPrice("")
    setNotes("")
    setError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  function handlePickVehicle(match: PlateMatch) {
    setSelectedVehicle(match)
    setPlateTerm(match.plate_number)
    setPlateResults([])
    if (match.customer_name) {
      setCustomerName(match.customer_name)
    }
  }

  function handleClearVehicle() {
    setSelectedVehicle(null)
    setPlateTerm("")
    setPlateResults([])
    setCustomerName("")
    setCustomerPhone("")
  }

  function handlePackageChange(pkgId: string) {
    setPackageId(pkgId)
    const pkg = packages.find((p) => p.id === pkgId)
    if (pkg) setPrice(String(pkg.price))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const numPrice = parseFloat(price)
    const validErr = validateNewWash({ package_id: packageId, price: numPrice })
    if (validErr) {
      setError(t(`wash.errors.${validErr}`))
      return
    }

    // If creating a new vehicle (no selected match), plate is required
    if (!selectedVehicle && !plateTerm.trim()) {
      setError(t("wash.errors.plate_required"))
      return
    }

    if (!claims.tenantId) {
      setError(t("wash.errors.generic"))
      return
    }

    setSubmitting(true)
    try {
      let vehicleId: string | null = selectedVehicle?.id ?? null
      let customerId: string | null = selectedVehicle?.customer_id ?? null

      if (!selectedVehicle) {
        // Create customer first if name is provided
        if (customerName.trim()) {
          customerId = await createCustomer(claims.tenantId, {
            name: customerName.trim(),
            phone: customerPhone.trim() || null,
          })
        }
        // Create vehicle
        vehicleId = await createVehicle(claims.tenantId, {
          customer_id: customerId,
          plate_number: plateTerm.trim(),
          make: make.trim() || null,
          model: model.trim() || null,
          color: color.trim() || null,
        })
      } else if (!selectedVehicle.customer_id && customerName.trim()) {
        // Existing vehicle but no customer — optionally link one
        customerId = await createCustomer(claims.tenantId, {
          name: customerName.trim(),
          phone: customerPhone.trim() || null,
        })
      }

      await createWashOrder(claims.tenantId, {
        branch_id: branchId,
        price: numPrice,
        package_id: packageId || null,
        vehicle_id: vehicleId,
        customer_id: customerId,
        notes: notes.trim() || null,
      })

      handleOpenChange(false)
      onCreated()
    } catch {
      setError(t("wash.errors.generic"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto max-h-[90dvh] overflow-y-auto">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{t("wash.create")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {/* Vehicle / Plate */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-wash-plate">{t("wash.plate")}</Label>
              <div className="flex gap-2">
                <Input
                  id="new-wash-plate"
                  value={plateTerm}
                  onChange={(e) => {
                    if (selectedVehicle) handleClearVehicle()
                    setPlateTerm(e.target.value)
                  }}
                  disabled={submitting}
                  className="min-h-[44px] flex-1"
                  autoComplete="off"
                  placeholder={t("wash.findOrAddVehicle")}
                />
                {selectedVehicle && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-[44px]"
                    onClick={handleClearVehicle}
                    disabled={submitting}
                  >
                    ×
                  </Button>
                )}
              </div>

              {/* Search results dropdown */}
              {!selectedVehicle && plateTerm.trim() && plateResults.length > 0 && (
                <ul
                  role="list"
                  className="flex flex-col gap-1 rounded-md border bg-background p-1"
                >
                  {plateResults.map((match) => (
                    <li key={match.id}>
                      <button
                        type="button"
                        onClick={() => handlePickVehicle(match)}
                        className="w-full text-start rounded px-3 py-2 text-sm hover:bg-muted min-h-[44px] flex flex-col justify-center"
                      >
                        <span className="font-semibold">{match.plate_number}</span>
                        <span className="text-muted-foreground text-xs">
                          {[match.make, match.model].filter(Boolean).join(" ")}
                          {match.customer_name ? ` · ${match.customer_name}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {plateSearching && (
                <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
              )}

              {/* New vehicle details toggle */}
              {!selectedVehicle && plateTerm.trim() && !plateSearching && (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline text-start"
                  onClick={() => setShowDetails((v) => !v)}
                >
                  {t("wash.newVehicle")}
                </button>
              )}

              {showDetails && !selectedVehicle && (
                <div className="flex flex-col gap-2 rounded-md border p-3 mt-1">
                  <Input
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    disabled={submitting}
                    placeholder={t("vehicles.make")}
                    className="min-h-[44px]"
                    autoComplete="off"
                  />
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    disabled={submitting}
                    placeholder={t("vehicles.model")}
                    className="min-h-[44px]"
                    autoComplete="off"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={submitting}
                    placeholder={t("vehicles.color")}
                    className="min-h-[44px]"
                    autoComplete="off"
                  />
                </div>
              )}
            </div>

            {/* Customer (optional quick add) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-wash-customer-name">
                {t("wash.customerName")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="new-wash-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                disabled={submitting || (!!selectedVehicle && !!selectedVehicle.customer_id)}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-wash-customer-phone">
                {t("wash.customerPhone")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="new-wash-customer-phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                disabled={submitting || (!!selectedVehicle && !!selectedVehicle.customer_id)}
                className="min-h-[44px]"
                autoComplete="off"
                type="tel"
              />
            </div>

            {/* Package */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-wash-package">{t("wash.package")}</Label>
              <Select
                value={packageId}
                onValueChange={handlePackageChange}
                disabled={submitting}
              >
                <SelectTrigger id="new-wash-package" className="min-h-[44px]">
                  <SelectValue placeholder={t("wash.package")} />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price (editable, defaults from package) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-wash-price">{t("wash.price")}</Label>
              <Input
                id="new-wash-price"
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-wash-notes">
                {t("wash.notes")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="new-wash-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="min-h-[44px]"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting} className="min-h-[44px]">
              {submitting ? t("common.loading") : t("wash.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
