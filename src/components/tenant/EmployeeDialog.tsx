import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
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
import { createEmployee, updateEmployee, type Employee } from "@/lib/tenant/employees"
import { listBranches, type Branch } from "@/lib/tenant/branches"
import { validateEmployee } from "@/lib/tenant/validators"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  onSaved: () => void
}

const NO_BRANCH = "__none__"

export function EmployeeDialog({ open, onOpenChange, employee, onSaved }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [branchId, setBranchId] = useState<string>(NO_BRANCH)
  const [isActive, setIsActive] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    if (open) {
      setName(employee?.name ?? "")
      setPhone(employee?.phone ?? "")
      setBranchId(employee?.branch_id ?? NO_BRANCH)
      setIsActive(employee?.is_active ?? true)
      setFieldError(null)
      // load branches for select
      listBranches().then(setBranches).catch(() => setBranches([]))
    }
  }, [open, employee])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setPhone("")
      setBranchId(NO_BRANCH)
      setIsActive(true)
      setFieldError(null)
      setBranches([])
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

    if (!employee && !claims.tenantId) {
      setFieldError(t("staff.errors.generic"))
      return
    }

    const resolvedBranchId = branchId === NO_BRANCH ? null : branchId

    setSubmitting(true)
    try {
      if (employee) {
        await updateEmployee(employee.id, {
          name,
          phone: phone || null,
          branch_id: resolvedBranchId,
          is_active: isActive,
        })
      } else {
        await createEmployee(claims.tenantId!, {
          name,
          phone: phone || null,
          branch_id: resolvedBranchId,
          is_active: isActive,
        })
      }
      handleOpenChange(false)
      onSaved()
    } catch {
      setFieldError(t("staff.errors.generic"))
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
