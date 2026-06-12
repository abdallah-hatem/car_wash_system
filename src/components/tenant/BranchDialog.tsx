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
import { useBranchMutations } from "@/lib/tenant/queries"
import type { Branch } from "@/lib/tenant/branches"
import { validateBranch } from "@/lib/tenant/validators"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  branch?: Branch | null
  onSaved?: () => void
}

export function BranchDialog({ open, onOpenChange, branch, onSaved }: Props) {
  const { t } = useTranslation()
  const { claims } = useAuth()
  const mutations = useBranchMutations()

  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(branch?.name ?? "")
      setAddress(branch?.address ?? "")
      setFieldError(null)
    }
  }, [open, branch])

  function handleOpenChange(next: boolean) {
    if (!next) {
      setName("")
      setAddress("")
      setFieldError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const validationCode = validateBranch({ name })
    if (validationCode) {
      setFieldError(t(`validation.${validationCode}`))
      return
    }

    if (!branch && !claims.tenantId) {
      setFieldError(t("branches.errors.generic"))
      return
    }

    try {
      if (branch) {
        await mutations.update.mutateAsync({ id: branch.id, input: { name, address: address || null } })
      } else {
        await mutations.create.mutateAsync({ tenantId: claims.tenantId!, input: { name, address: address || null } })
      }
      handleOpenChange(false)
      onSaved?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "generic"
      if (msg === "in_use") {
        setFieldError(t("branches.errors.in_use"))
      } else {
        setFieldError(t("branches.errors.generic"))
      }
    }
  }

  const submitting = mutations.create.isPending || mutations.update.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto">
        <form onSubmit={(e) => void handleSubmit(e)} noValidate>
          <DialogHeader>
            <DialogTitle>
              {branch ? t("common.edit") : t("branches.newBranch")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-name">{t("branches.name")}</Label>
              <Input
                id="branch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-address">
                {t("branches.address")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="branch-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
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
              {!submitting && (branch ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {submitting ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
