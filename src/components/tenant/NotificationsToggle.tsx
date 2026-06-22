import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Bell, BellOff, BellRing } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  currentPushState,
  disablePush,
  enablePush,
  pushSupported,
  type PushState,
} from "@/lib/notify/subscriptions"

/**
 * Header control to enable/disable web push notifications on this device.
 *
 * - Reflects the current push state (subscribed / unsubscribed / denied /
 *   unsupported) and toggles it on tap.
 * - When the browser can't do push (e.g. iOS Safari before "Add to Home
 *   Screen") it renders a disabled bell with an explanatory hint instead of
 *   disappearing, so the operator understands why.
 */
export function NotificationsToggle() {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<PushState>("unsubscribed")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(() => {
    void currentPushState().then(setState)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Unsupported: show a disabled bell with a hint (don't hide it entirely).
  if (!pushSupported() || state === "unsupported") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        className="min-h-[44px] min-w-[44px] shrink-0"
        aria-label={t("notify.unsupported")}
        title={t("notify.unsupported")}
      >
        <BellOff className="h-5 w-5" aria-hidden="true" />
      </Button>
    )
  }

  // Permission was blocked in the browser — can't re-prompt programmatically.
  if (state === "denied") {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled
        className="min-h-[44px] min-w-[44px] shrink-0"
        aria-label={t("notify.blocked")}
        title={t("notify.blocked")}
      >
        <BellOff className="h-5 w-5" aria-hidden="true" />
      </Button>
    )
  }

  const subscribed = state === "subscribed"

  async function toggle() {
    if (busy) return
    setBusy(true)
    try {
      if (subscribed) {
        await disablePush()
      } else {
        await enablePush(i18n.language)
      }
    } catch {
      // Permission denial or a transient error — re-read the real state below.
    } finally {
      const next = await currentPushState()
      setState(next)
      setBusy(false)
    }
  }

  const label = subscribed ? t("notify.disable") : t("notify.enable")

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={busy}
      className="min-h-[44px] min-w-[44px] shrink-0"
      aria-label={subscribed ? t("notify.enabled") : label}
      title={subscribed ? t("notify.enabled") : label}
      aria-pressed={subscribed}
      onClick={() => void toggle()}
    >
      {subscribed ? (
        <BellRing className="h-5 w-5" aria-hidden="true" />
      ) : (
        <Bell className="h-5 w-5" aria-hidden="true" />
      )}
    </Button>
  )
}
