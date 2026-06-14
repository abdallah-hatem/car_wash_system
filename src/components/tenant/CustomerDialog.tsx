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
import { useCustomerMutations } from "@/lib/tenant/queries"
import type { Customer } from "@/lib/tenant/customers"
import { validateCustomer } from "@/lib/tenant/validators"
import { isValidEgyptianMobile, formatPhoneForStore } from "@/lib/tenant/phone"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSaved?: () => void
}

export function CustomerDialog({ open, onOpenChange, customer, onSaved }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const mutations = useCustomerMutations()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(customer?.name ?? "")
      setPhone(customer?.phone ?? "")
      setFieldError(null)
    }
  }, [open, customer])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setPhone("")
      setFieldError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const validationCode = validateCustomer({ name })
    if (validationCode) {
      setFieldError(t(`validation.${validationCode}`))
      return
    }

    if (phone.trim() && !isValidEgyptianMobile(phone)) {
      setFieldError(t("validation.phone_invalid"))
      return
    }

    if (!customer && !claims.tenantId) {
      setFieldError(t("customers.errors.generic"))
      return
    }

    const normalizedPhone = phone.trim() ? formatPhoneForStore(phone) : null

    try {
      if (customer) {
        await mutations.update.mutateAsync({ id: customer.id, input: { name, phone: normalizedPhone } })
      } else {
        await mutations.create.mutateAsync({ tenantId: claims.tenantId!, input: { name, phone: normalizedPhone } })
      }
      handleOpenChange(false)
      onSaved?.()
    } catch {
      setFieldError(t("customers.errors.generic"))
    }
  }

  const submitting = mutations.create.isPending || mutations.update.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto">
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {customer ? t("common.edit") : t("customers.newCustomer")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer-name">{t("customers.name")}</Label>
              <Input
                id="customer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer-phone">
                {t("customers.phone")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="customer-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
                type="tel"
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
              {!submitting && (customer ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {submitting ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
