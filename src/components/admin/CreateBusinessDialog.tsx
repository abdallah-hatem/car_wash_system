import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
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
  createBusiness,
  validateCreate,
  type CreateBusinessResult,
} from "@/lib/admin"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}

type ViewState = "form" | "success"

export function CreateBusinessDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation()

  const [businessName, setBusinessName] = useState("")
  const [ownerEmail, setOwnerEmail] = useState("")
  const [ownerFullName, setOwnerFullName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>("form")
  const [result, setResult] = useState<CreateBusinessResult | null>(null)
  const [copied, setCopied] = useState(false)

  function reset() {
    setBusinessName("")
    setOwnerEmail("")
    setOwnerFullName("")
    setSubmitting(false)
    setFieldError(null)
    setView("form")
    setResult(null)
    setCopied(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFieldError(null)

    const validationCode = validateCreate({ businessName, ownerEmail, ownerFullName })
    if (validationCode) {
      setFieldError(t(`admin.errors.${validationCode}`))
      return
    }

    setSubmitting(true)
    try {
      const res = await createBusiness({ businessName, ownerEmail, ownerFullName })
      setResult(res)
      setView("success")
    } catch (err) {
      const code = err instanceof Error ? err.message : "generic"
      const knownCodes = ["email_exists", "missing_fields", "generic"]
      const safeCode = knownCodes.includes(code) ? code : "generic"
      setFieldError(t(`admin.errors.${safeCode}`))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore — clipboard may be unavailable */
    }
  }

  function handleDone() {
    handleOpenChange(false)
    onCreated()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto">
        {view === "form" ? (
          <form onSubmit={handleSubmit} noValidate>
            <DialogHeader>
              <DialogTitle>{t("admin.create.title")}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-4">
              {/* Business name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cb-business-name">
                  {t("admin.create.businessName")}
                </Label>
                <Input
                  id="cb-business-name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  disabled={submitting}
                  autoComplete="organization"
                  className="min-h-[44px]"
                />
              </div>

              {/* Owner email */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cb-owner-email">
                  {t("admin.create.ownerEmail")}
                </Label>
                <Input
                  id="cb-owner-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  disabled={submitting}
                  autoComplete="email"
                  className="min-h-[44px]"
                />
              </div>

              {/* Owner full name */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cb-owner-name">
                  {t("admin.create.ownerName")}
                </Label>
                <Input
                  id="cb-owner-name"
                  value={ownerFullName}
                  onChange={(e) => setOwnerFullName(e.target.value)}
                  disabled={submitting}
                  autoComplete="name"
                  className="min-h-[44px]"
                />
              </div>

              {/* Inline error */}
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
                {t("admin.create.cancel")}
              </Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {!submitting && <Plus className="h-4 w-4" />}
                {submitting ? t("admin.create.creating") : t("admin.create.submit")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          /* Success view */
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("admin.create.successTitle")}</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              {result?.ownerEmail}
            </p>

            <div className="flex flex-col gap-1.5">
              <Label>{t("admin.create.tempPasswordLabel")}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-sm select-all break-all">
                  {result?.tempPassword}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0"
                >
                  {copied ? t("admin.create.copied") : t("admin.create.copy")}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" onClick={handleDone} className="w-full gap-1.5">
                {t("admin.create.done")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
