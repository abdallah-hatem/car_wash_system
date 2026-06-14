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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/auth/AuthProvider"
import { useBranches, useEmployeeMutations } from "@/lib/tenant/queries"
import type { Employee } from "@/lib/tenant/employees"
import { validateEmployee } from "@/lib/tenant/validators"
import { isValidEgyptianMobile, formatPhoneForStore } from "@/lib/tenant/phone"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  onSaved?: () => void
}

const NO_BRANCH = "__none__"

export function EmployeeDialog({ open, onOpenChange, employee, onSaved }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const { data: branches = [] } = useBranches()
  const mutations = useEmployeeMutations()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [branchId, setBranchId] = useState<string>(NO_BRANCH)
  const [isActive, setIsActive] = useState(true)
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(employee?.name ?? "")
      setPhone(employee?.phone ?? "")
      setBranchId(employee?.branch_id ?? NO_BRANCH)
      setIsActive(employee?.is_active ?? true)
      setFieldError(null)
    }
  }, [open, employee])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setPhone("")
      setBranchId(NO_BRANCH)
      setIsActive(true)
      setFieldError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const validationCode = validateEmployee({ name })
    if (validationCode) {
      setFieldError(t(`validation.${validationCode}`))
      return
    }

    if (phone.trim() && !isValidEgyptianMobile(phone)) {
      setFieldError(t("validation.phone_invalid"))
      return
    }

    if (!employee && !claims.tenantId) {
      setFieldError(t("staff.errors.generic"))
      return
    }

    const resolvedBranchId = branchId === NO_BRANCH ? null : branchId
    const normalizedPhone = phone.trim() ? formatPhoneForStore(phone) : null

    try {
      if (employee) {
        await mutations.update.mutateAsync({
          id: employee.id,
          input: {
            name,
            phone: normalizedPhone,
            branch_id: resolvedBranchId,
            is_active: isActive,
          },
        })
      } else {
        await mutations.create.mutateAsync({
          tenantId: claims.tenantId!,
          input: {
            name,
            phone: normalizedPhone,
            branch_id: resolvedBranchId,
            is_active: isActive,
          },
        })
      }
      handleOpenChange(false)
      onSaved?.()
    } catch {
      setFieldError(t("staff.errors.generic"))
    }
  }

  const submitting = mutations.create.isPending || mutations.update.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto">
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {employee ? t("common.edit") : t("staff.newEmployee")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-name">{t("staff.name")}</Label>
              <Input
                id="emp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-phone">
                {t("staff.phone")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="emp-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                inputMode="tel"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-branch">
                {t("staff.branch")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Select
                value={branchId}
                onValueChange={setBranchId}
                disabled={submitting}
              >
                <SelectTrigger id="emp-branch" className="min-h-[44px]">
                  <SelectValue placeholder={t("staff.noBranch")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_BRANCH}>{t("staff.noBranch")}</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="emp-active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4"
              />
              <Label htmlFor="emp-active">{t("common.active")}</Label>
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
              {!submitting && (employee ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {submitting ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
