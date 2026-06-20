import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * Landing page for the invite / password-reset link emailed via Resend.
 * Supabase (detectSessionInUrl) parses the recovery token from the URL hash on
 * load and establishes a session; the user then sets a password. No session
 * (direct visit / expired link) → show an "invalid link" message.
 */
export default function SetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [ready, setReady] = useState<boolean | null>(null) // null = checking
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setReady((prev) => (prev === true ? true : !!data.session))
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active && session) setReady(true)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError(t("setPassword.tooShort"))
      return
    }
    if (password !== confirm) {
      setError(t("setPassword.mismatch"))
      return
    }
    setSubmitting(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (err) {
      setError(t("setPassword.error"))
      return
    }
    navigate("/app", { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-background p-6 shadow-sm">
        <div className="mb-5">
          <span className="rounded-md bg-primary px-2.5 py-1 text-sm font-bold text-primary-foreground">
            WashFlow
          </span>
        </div>

        {ready === false ? (
          <div className="flex flex-col gap-3">
            <h1 className="text-lg font-semibold">{t("setPassword.invalidTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("setPassword.invalidBody")}</p>
            <Button variant="outline" onClick={() => navigate("/login")} className="min-h-[44px] w-fit">
              {t("setPassword.toLogin")}
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-semibold">{t("setPassword.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("setPassword.subtitle")}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-password">{t("setPassword.password")}</Label>
              <Input
                id="sp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting || ready === null}
                className="min-h-[44px]"
                autoComplete="new-password"
                placeholder={t("setPassword.hint")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-confirm">{t("setPassword.confirm")}</Label>
              <Input
                id="sp-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={submitting || ready === null}
                className="min-h-[44px]"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" disabled={submitting || ready === null} className="min-h-[44px]">
              {submitting ? t("common.loading") : t("setPassword.submit")}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
