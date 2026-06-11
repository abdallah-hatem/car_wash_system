import { useState, useEffect } from "react"
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
import { useAuth } from "@/auth/AuthProvider"
import { createPackage, updatePackage, type Package } from "@/lib/tenant/packages"
import { validatePackage } from "@/lib/tenant/validators"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  pkg?: Package | null
  onSaved: () => void
}

export function PackageDialog({ open, onOpenChange, pkg, onSaved }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()

  const [name, setName] = useState("")
  const [price, setPrice] = useState("")
  const [durationMinutes, setDurationMinutes] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(pkg?.name ?? "")
      setPrice(pkg?.price != null ? String(pkg.price) : "")
      setDurationMinutes(pkg?.duration_minutes != null ? String(pkg.duration_minutes) : "")
      setIsActive(pkg?.is_active ?? true)
      setFieldError(null)
    }
  }, [open, pkg])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setPrice("")
      setDurationMinutes("")
      setIsActive(true)
      setFieldError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const priceNum = parseFloat(price)
    const validationCode = validatePackage({ name, price: priceNum })
    if (validationCode) {
      setFieldError(t(`validation.${validationCode}`))
      return
    }

    if (!pkg && !claims.tenantId) {
      setFieldError(t("packages.errors.generic"))
      return
    }

    const durationNum = durationMinutes.trim() ? parseInt(durationMinutes, 10) : null

    setSubmitting(true)
    try {
      if (pkg) {
        await updatePackage(pkg.id, { name, price: priceNum, duration_minutes: durationNum, is_active: isActive })
      } else {
        await createPackage(claims.tenantId!, { name, price: priceNum, duration_minutes: durationNum, is_active: isActive })
      }
      handleOpenChange(false)
      onSaved()
    } catch {
      setFieldError(t("packages.errors.generic"))
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
              {pkg ? t("common.edit") : t("packages.newPackage")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-name">{t("packages.name")}</Label>
              <Input
                id="pkg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-price">{t("packages.price")}</Label>
              <Input
                id="pkg-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                inputMode="decimal"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pkg-duration">
                {t("packages.duration")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="pkg-duration"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                inputMode="numeric"
                autoComplete="off"
                placeholder={t("packages.minutes")}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                id="pkg-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4"
              />
              <Label htmlFor="pkg-active">{t("common.active")}</Label>
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
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
              className="min-h-[44px]"
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting} className="min-h-[44px]">
              {submitting ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
