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
import { cn } from "@/lib/utils"
import { useBranches, useUserMutations } from "@/lib/tenant/queries"
import type { ManagedUser } from "@/lib/tenant/users"
import type { TabKey, PermLevel } from "@/auth/claims"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: ManagedUser | null
  onSaved?: () => void
}

// Permission-gated tabs. `viewOnly` tabs (read-only screens) have no edit level.
const PERMISSION_TABS: { key: TabKey; viewOnly?: boolean }[] = [
  { key: "dashboard", viewOnly: true },
  { key: "analytics", viewOnly: true },
  { key: "queue" },
  { key: "washes", viewOnly: true },
  { key: "customers" },
  { key: "packages" },
  { key: "staff" },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function UserDialog({ open, onOpenChange, user, onSaved }: Props) {
  const { t } = useTranslation()
  const { data: branches = [] } = useBranches()
  const mutations = useUserMutations()
  const editing = !!user

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [permissions, setPermissions] = useState<Partial<Record<TabKey, PermLevel>>>({})
  const [fieldError, setFieldError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setEmail(user?.email ?? "")
      setPassword("")
      setFullName(user?.fullName ?? "")
      setBranchIds(user?.branchIds ?? [])
      setPermissions(user?.permissions ?? {})
      setFieldError(null)
    }
  }, [open, user])

  function toggleBranch(id: string) {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]))
  }

  function setLevel(tab: TabKey, level: PermLevel) {
    setPermissions((prev) => {
      const next = { ...prev }
      if (level === "none") delete next[tab]
      else next[tab] = level
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    if (!editing && !EMAIL_RE.test(email.trim())) {
      setFieldError(t("users.errors.invalid"))
      return
    }
    // Password required on create; optional on edit (blank = keep current).
    if (!editing && password.length < 8) {
      setFieldError(t("users.errors.invalid"))
      return
    }
    if (editing && password.length > 0 && password.length < 8) {
      setFieldError(t("users.errors.invalid"))
      return
    }

    try {
      if (editing && user) {
        await mutations.update.mutateAsync({ userId: user.userId, fullName, branchIds, permissions })
        if (password.length >= 8) {
          await mutations.resetPassword.mutateAsync({ userId: user.userId, password })
        }
      } else {
        await mutations.create.mutateAsync({ email: email.trim(), password, fullName, branchIds, permissions })
      }
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      const code = err instanceof Error ? err.message : "generic"
      const known = ["invalid", "email_exists", "not_found", "forbidden"]
      setFieldError(t(`users.errors.${known.includes(code) ? code : "generic"}`))
    }
  }

  const submitting = mutations.create.isPending || mutations.update.isPending || mutations.resetPassword.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto flex max-h-[88vh] w-full max-w-lg flex-col">
        <DialogHeader>
          <DialogTitle>{editing ? t("users.editUser") : t("users.newUser")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4 pe-1">
            {/* Identity */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-email">{t("users.email")}</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || editing}
                className="min-h-[44px]"
                autoComplete="off"
                inputMode="email"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-name">
                {t("users.fullName")}{" "}
                <span className="text-muted-foreground text-xs">({t("common.optional")})</span>
              </Label>
              <Input
                id="user-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="user-password">
                {editing ? t("users.newPasswordOptional") : t("users.password")}
              </Label>
              <Input
                id="user-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="min-h-[44px]"
                autoComplete="new-password"
                placeholder={t("users.passwordHint")}
              />
            </div>

            {/* Branches */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.branches")}</Label>
              <p className="text-xs text-muted-foreground">{t("users.branchesHint")}</p>
              <div className="flex flex-col gap-1 rounded-md border p-2">
                {branches.length === 0 ? (
                  <p className="px-1 py-2 text-sm text-muted-foreground">{t("users.noBranchesAvailable")}</p>
                ) : (
                  branches.map((b) => (
                    <label
                      key={b.id}
                      className="flex min-h-[40px] cursor-pointer items-center gap-2.5 rounded px-2 hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={branchIds.includes(b.id)}
                        onChange={() => toggleBranch(b.id)}
                        disabled={submitting}
                      />
                      <span className="text-sm">{b.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Permission grid */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("users.permissions")}</Label>
              <p className="text-xs text-muted-foreground">{t("users.permissionsHint")}</p>
              <div className="flex flex-col divide-y rounded-md border">
                {PERMISSION_TABS.map(({ key, viewOnly }) => {
                  const levels: PermLevel[] = viewOnly ? ["none", "view"] : ["none", "view", "edit"]
                  const current = permissions[key] ?? "none"
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="text-sm font-medium">{t(`nav.${key}`)}</span>
                      <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                        {levels.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            disabled={submitting}
                            onClick={() => setLevel(key, lvl)}
                            className={cn(
                              "min-h-[32px] rounded px-2.5 py-1 text-xs font-medium transition-colors",
                              current === lvl
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {t(`users.level.${lvl}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{t("users.claimsNote")}</p>

            {fieldError && (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting} className="gap-1.5">
              {!submitting && (editing ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
              {submitting ? t("common.loading") : t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
