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
import { PhoneInput } from "@/components/ui/phone-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/auth/AuthProvider"
import { useBranch } from "@/lib/tenant/branch-context"
import { useCustomerMutations, useBranches } from "@/lib/tenant/queries"
import type { Customer } from "@/lib/tenant/customers"
import { validateCustomer } from "@/lib/tenant/validators"
import { isValidEgyptianMobile, formatPhoneForStore } from "@/lib/tenant/phone"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSaved?: () => void
  /**
   * Branch pre-selected for a new customer. Callers pass the branch the user is
   * currently looking at; falls back to the shared branch context when absent.
   */
  defaultBranchId?: string | null
}

export function CustomerDialog({ open, onOpenChange, customer, onSaved, defaultBranchId }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const { branchId } = useBranch()
  const { data: branches = [] } = useBranches()
  const mutations = useCustomerMutations()

  const initialBranch = defaultBranchId ?? branchId ?? ""

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [branch, setBranch] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(customer?.name ?? "")
      setPhone(customer?.phone ?? "")
      setBranch(customer?.branch_id ?? initialBranch)
      setFieldError(null)
    }
    // initialBranch is only read when the dialog opens; re-running on context
    // changes would clobber a choice the user already made.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setPhone("")
      setBranch("")
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
        await mutations.create.mutateAsync({ tenantId: claims.tenantId!, input: { name, phone: normalizedPhone, branch_id: branch || null } })
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

            <PhoneInput
              id="customer-phone"
              value={phone}
              onChange={setPhone}
              disabled={submitting}
              label={
                <>
                  {t("customers.phone")}{" "}
                  <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
                </>
              }
            />

            {!customer && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer-branch">{t("customers.branch")}</Label>
                <Select value={branch} onValueChange={setBranch} disabled={submitting}>
                  <SelectTrigger id="customer-branch" className="min-h-[44px]">
                    <SelectValue placeholder={t("customers.selectBranch")} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
