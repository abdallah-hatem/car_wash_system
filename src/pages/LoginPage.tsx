import { useMemo, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { Droplets, Loader2, LockKeyhole, Mail, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { cn } from "@/lib/utils"

/**
 * Distinctive split-canvas login for the carwash SaaS.
 *
 * Left (lg+): an immersive "fresh detail" brand panel — deep teal→midnight
 * gradient with a drifting droplet field and a single chrome shine sweep.
 * Right / mobile: a frosted glass form over the same atmosphere so it stays
 * on-brand and legible on tablet and phone.
 */

// Deterministic droplet field so layout is stable across renders.
const DROPLETS = Array.from({ length: 14 }, (_, i) => {
  const seed = (i * 9301 + 49297) % 233280
  const r = seed / 233280
  return {
    inset: `${(r * 100).toFixed(2)}%`,
    size: 4 + Math.round(r * 14),
    duration: `${(7 + r * 9).toFixed(2)}s`,
    delay: `${(r * 8).toFixed(2)}s`,
    opacity: 0.25 + r * 0.45,
  }
})

function DropletField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {DROPLETS.map((d, i) => (
        <span
          key={i}
          className="cw-droplet absolute bottom-[-24px] rounded-full bg-white/70 shadow-[0_0_12px_rgba(255,255,255,0.45)]"
          style={{
            insetInlineStart: d.inset,
            width: d.size,
            height: d.size,
            animationDuration: d.duration,
            animationDelay: d.delay,
            ["--cw-drop-opacity" as string]: String(d.opacity),
          }}
        />
      ))}
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const year = useMemo(() => new Date().getFullYear(), [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (signInError) {
      setError(signInError.message)
      setSubmitting(false)
      return
    }
    navigate("/")
  }

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_1fr]">
      {/* Brand canvas — full-bleed background everywhere, content shown on lg+ */}
      <div className="relative overflow-hidden bg-[radial-gradient(120%_120%_at_15%_0%,#0c5b63_0%,#083f4d_42%,#06222e_100%)] lg:rounded-e-[2.5rem]">
        {/* faint grid texture */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px]"
        />
        {/* soft cyan glow */}
        <div
          aria-hidden="true"
          className="absolute -start-24 top-1/4 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl"
        />
        <DropletField />
        {/* chrome shine sweep */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <div className="cw-shine absolute -inset-y-10 start-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        <div className="relative z-10 hidden h-full flex-col justify-between p-12 text-white lg:flex">
          <div className="cw-rise flex items-center gap-3" style={{ animationDelay: "60ms" }}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/25 backdrop-blur">
              <Droplets className="h-6 w-6 text-cyan-200" />
            </span>
            <span className="text-lg font-semibold tracking-tight">{t("common.appName")}</span>
          </div>

          <div className="max-w-md">
            <p
              className="cw-rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-100 ring-1 ring-white/15"
              style={{ animationDelay: "120ms" }}
            >
              <Sparkles className="h-3.5 w-3.5" /> {t("auth.brandBadge")}
            </p>
            <h1
              className="cw-rise mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight"
              style={{ animationDelay: "180ms" }}
            >
              {t("auth.brandHeadlineLead")}
              <br />
              <span className="bg-gradient-to-r from-cyan-200 to-white bg-clip-text text-transparent">
                {t("auth.brandHeadlineAccent")}
              </span>
            </h1>
            <p
              className="cw-rise mt-5 text-pretty text-base leading-relaxed text-cyan-50/80"
              style={{ animationDelay: "240ms" }}
            >
              {t("auth.brandBody")}
            </p>
          </div>

          <div
            className="cw-rise flex items-center gap-6 text-sm text-cyan-50/70"
            style={{ animationDelay: "300ms" }}
          >
            <span className="font-medium text-white">{t("auth.featureFastCheckouts")}</span>
            <span className="h-1 w-1 rounded-full bg-cyan-200/60" />
            <span className="font-medium text-white">{t("auth.featureLiveBayStatus")}</span>
            <span className="h-1 w-1 rounded-full bg-cyan-200/60" />
            <span className="font-medium text-white">{t("auth.featureMultiBranch")}</span>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
        {/* Language switcher — reachable on mobile where the brand panel is hidden */}
        <div className="absolute end-4 top-4">
          <LanguageSwitcher />
        </div>
        <div
          className="cw-rise w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-10"
          style={{ animationDelay: "80ms" }}
        >
          {/* compact brand mark for mobile/tablet */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow">
              <Droplets className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              {t("common.appName")}
            </span>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {t("auth.signInTitle")}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">{t("auth.tagline")}</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">
                {t("auth.email")}
              </Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@carwash.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  aria-invalid={error ? true : undefined}
                  className="h-11 bg-white ps-9 text-slate-900 focus-visible:ring-teal-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">
                {t("auth.password")}
              </Label>
              <div className="relative">
                <LockKeyhole
                  aria-hidden="true"
                  className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  aria-invalid={error ? true : undefined}
                  className="h-11 bg-white ps-9 text-slate-900 focus-visible:ring-teal-600"
                />
              </div>
            </div>

            <div aria-live="polite" className="min-h-[1.25rem]">
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className={cn(
                "h-11 w-full bg-gradient-to-br from-teal-600 to-cyan-700 text-base font-medium text-white shadow-lg shadow-teal-900/20 transition-transform hover:from-teal-600 hover:to-cyan-600 active:scale-[0.99]",
                "focus-visible:ring-teal-700 focus-visible:ring-offset-2",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("auth.signingIn")}
                </>
              ) : (
                t("auth.signInButton")
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            {t("auth.footer", { year, appName: t("common.appName") })}
          </p>
        </div>
      </div>
    </div>
  )
}
