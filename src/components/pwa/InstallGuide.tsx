import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Share, MoreVertical, Plus, Check } from "lucide-react"
import { isIos } from "@/lib/pwa/platform"

/**
 * How to put this on the home screen, shown rather than described.
 *
 * "Add it to your home screen" is a sentence people read and do not act on.
 * The share icon is the problem: on iOS it is the only way in, it is
 * unlabelled, and an operator who has never deliberately used it does not know
 * which toolbar glyph it is. A drawing of the toolbar with that one icon
 * pulsing answers the question the sentence raises.
 *
 * It is not decoration. On iOS this is the only route to web push — Safari
 * gives no notifications at all until the app is installed, and nothing on
 * screen ever says so. A branch that never installs never hears that a wash
 * was completed.
 *
 * Ported from the storefront's install guide; adapted to react-i18next, the
 * app's own theme tokens, and RTL driven by the active language.
 */

type Platform = "ios" | "android"

const IOS_STEPS = ["share", "find", "add"] as const
const ANDROID_STEPS = ["menu", "install", "confirm"] as const

export function InstallGuide() {
  const { t } = useTranslation()

  // Defaults to iOS, replaced on mount. It only decides which drawing shows,
  // and the switch below lets anyone see the other one.
  const [platform, setPlatform] = useState<Platform>("ios")
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => setPlatform(isIos() ? "ios" : "android"), [])

  const steps = platform === "ios" ? IOS_STEPS : ANDROID_STEPS

  // Advance on a timer so it plays like a demonstration rather than waiting to
  // be operated. Someone who wants to study one step taps it in the list.
  useEffect(() => {
    if (!playing) return
    const id = setTimeout(() => setStep((s) => (s + 1) % steps.length), 2600)
    return () => clearTimeout(id)
  }, [playing, step, steps.length])

  return (
    <div className="flex flex-col gap-4">
      <div className="pe-6">
        <h2 className="text-lg font-bold">{t("install.title")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("install.why")}</p>
      </div>

      {/* Which phone. Shown even when detected, because detection can be wrong
          and because someone is often reading this to help a colleague holding
          the other kind. */}
      <div role="tablist" aria-label={t("install.choosePlatform")} className="flex gap-1 rounded-xl bg-muted p-1">
        {(["ios", "android"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={platform === p}
            onClick={() => {
              setPlatform(p)
              setStep(0)
              setPlaying(true)
            }}
            className={`min-h-[44px] flex-1 rounded-lg px-3 text-sm font-medium transition-colors ${
              platform === p ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(p === "ios" ? "install.iphone" : "install.android")}
          </button>
        ))}
      </div>

      <PhoneMock platform={platform} step={step} />

      {/* The steps as text as well as pictures. The animation shows where to
          tap; the words are what someone reads back to themselves while doing
          it, and they are what a screen reader gets. */}
      <ol className="space-y-2">
        {steps.map((key, i) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => {
                setStep(i)
                setPlaying(false)
              }}
              aria-current={step === i ? "step" : undefined}
              className={`flex min-h-[44px] w-full items-center gap-3 rounded-xl p-2.5 text-start transition-colors ${
                step === i ? "bg-primary/10" : "hover:bg-muted"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  step === i ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm ${step === i ? "font-medium" : "text-muted-foreground"}`}>
                {t(`install.steps.${platform}.${key}`)}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* No dark: variants here. Tailwind's darkMode is unset, so those would
          fire from the OS setting while the rest of the app themes off a .dark
          class and stays light -- giving one dark box in a light dialog. */}
      <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
        {t("install.thenWhat")}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * A phone, drawn.
 *
 * Deliberately not a screenshot. A screenshot of one iOS version is wrong on
 * the next, is unreadable at this size, and cannot be translated — the words
 * inside it would stay English on an Arabic screen.
 */
function PhoneMock({ platform, step }: { platform: Platform; step: number }) {
  const { t } = useTranslation()

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-muted to-muted/60 p-4">
      <div
        className="mx-auto w-[190px] overflow-hidden rounded-[26px] border-[6px] border-slate-800 bg-white shadow-lg"
        // The drawing is a picture; its text is decorative and duplicated in
        // the list beneath, which is what a screen reader should read.
        aria-hidden="true"
      >
        <div className="flex items-center justify-between bg-white px-3 py-1.5 text-[9px] font-semibold text-slate-800">
          <span>10:10</span>
          <span className="h-1.5 w-8 rounded-full bg-slate-800" />
          <span>100%</span>
        </div>

        <div className="relative h-[210px] bg-slate-50">
          {platform === "ios" ? (
            <IosScreen step={step} label={t("install.addToHomeScreen")} />
          ) : (
            <AndroidScreen step={step} label={t("install.installApp")} />
          )}
        </div>
      </div>
    </div>
  )
}

/** A pulsing ring over whatever the current step wants tapped. */
function Tap({ className }: { className: string }) {
  return (
    <span className={`pointer-events-none absolute ${className}`}>
      <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
      <span className="absolute inset-0 rounded-full border-2 border-primary bg-primary/20" />
    </span>
  )
}

function IosScreen({ step, label }: { step: number; label: string }) {
  return (
    <>
      {/* The page behind, dimmed once the sheet is up. */}
      <div className={`p-3 transition-opacity ${step > 0 ? "opacity-30" : "opacity-100"}`}>
        <div className="h-2 w-16 rounded bg-slate-300" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="h-14 rounded-lg bg-slate-200" />
          <div className="h-14 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Safari's toolbar. Step 1 is the whole point of the drawing: which of
          these glyphs is the share button. */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-around border-t border-slate-200 bg-slate-100 px-2 py-2">
        <span className="h-3 w-3 rounded-sm bg-slate-400" />
        <span className="relative">
          <Share className="h-4 w-4 text-primary" strokeWidth={2.5} />
          {step === 0 && <Tap className="-inset-2 rounded-full" />}
        </span>
        <span className="h-3 w-3 rounded-sm bg-slate-400" />
      </div>

      {/* The share sheet, sliding up. */}
      <div
        className={`absolute inset-x-0 bottom-0 rounded-t-xl border-t border-slate-200 bg-white p-2 shadow-lg transition-transform duration-500 ${
          step > 0 ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-2 h-1 w-8 rounded-full bg-slate-300" />
        <div className="space-y-1">
          <div className="h-5 rounded bg-slate-100" />
          <div className="h-5 rounded bg-slate-100" />
          {/* The row they are looking for. */}
          <div
            className={`relative flex items-center justify-between rounded px-2 py-1.5 transition-colors ${
              step >= 1 ? "bg-primary/10" : ""
            }`}
          >
            <span className="text-[8px] font-medium text-slate-900">{label}</span>
            <Plus className="h-3 w-3 text-slate-600" strokeWidth={3} />
            {step === 1 && <Tap className="-inset-1 rounded-lg" />}
          </div>
          <div className="h-5 rounded bg-slate-100" />
        </div>
      </div>

      {step === 2 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Check className="h-6 w-6" strokeWidth={3} />
          </span>
        </div>
      )}
    </>
  )
}

function AndroidScreen({ step, label }: { step: number; label: string }) {
  return (
    <>
      {/* Chrome's toolbar is at the top and its menu at the inline end, which
          mirrors under Arabic — hence a logical property rather than pinning
          it right. */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-2 py-1.5">
        <span className="h-2 w-20 rounded bg-slate-300" />
        <span className="relative">
          <MoreVertical className="h-4 w-4 text-primary" strokeWidth={2.5} />
          {step === 0 && <Tap className="-inset-2 rounded-full" />}
        </span>
      </div>

      <div className={`p-3 transition-opacity ${step > 0 ? "opacity-30" : "opacity-100"}`}>
        <div className="h-2 w-16 rounded bg-slate-300" />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="h-14 rounded-lg bg-slate-200" />
          <div className="h-14 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* The dropdown, anchored under the menu button at the inline end.
          `end-2` unconditionally: it is a logical property, so it already
          follows the menu button to the other side under RTL. Switching it to
          `start` for Arabic — as the version this was ported from does — puts
          the menu on the opposite side from the button it belongs to. */}
      <div
        className={`absolute top-8 end-2 w-28 origin-top rounded-lg border border-slate-200 bg-white p-1 shadow-lg transition-all duration-300 ${
          step > 0 ? "scale-100 opacity-100" : "scale-90 opacity-0"
        }`}
      >
        <div className="h-4 rounded bg-slate-100" />
        <div
          className={`relative my-0.5 flex items-center gap-1 rounded px-1.5 py-1 transition-colors ${
            step >= 1 ? "bg-primary/10" : ""
          }`}
        >
          <Plus className="h-2.5 w-2.5 shrink-0 text-slate-600" strokeWidth={3} />
          <span className="text-[8px] font-medium text-slate-900">{label}</span>
          {step === 1 && <Tap className="-inset-1 rounded" />}
        </div>
        <div className="h-4 rounded bg-slate-100" />
      </div>

      {step === 2 && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Check className="h-6 w-6" strokeWidth={3} />
          </span>
        </div>
      )}
    </>
  )
}
