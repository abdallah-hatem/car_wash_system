/**
 * PWA update toast banner.
 *
 * A small fixed strip at the top of the viewport that appears when a new
 * service-worker build is waiting. Clicking "Reload" calls updateSW(true)
 * which posts SKIP_WAITING and reloads.
 *
 * RTL-safe: uses logical properties (ps-/pe-, start-).
 * Tap target: ≥ 44px (py-3 + text = ~44 px).
 * No third-party toast dep — inline fixed element so nothing heavy is added.
 */
import { useTranslation } from "react-i18next"

interface Props {
  onReload: () => void
  onDismiss: () => void
}

export function PwaUpdateBanner({ onReload, onDismiss }: Props) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      aria-live="polite"
      className="
        fixed start-0 end-0 top-0 z-[9999]
        flex items-center justify-between gap-4
        bg-[#0d9488] text-white
        ps-4 pe-3 py-3
        shadow-lg
      "
    >
      <span className="text-sm font-medium">{t("pwa.updateAvailable")}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReload}
          className="
            min-h-[44px] px-4 py-2 rounded-md
            text-sm font-semibold
            bg-white text-[#0d9488]
            hover:bg-teal-50 active:bg-teal-100
            focus-visible:outline-2 focus-visible:outline-white
            transition-colors
          "
        >
          {t("pwa.reload")}
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="
            min-h-[44px] min-w-[44px] flex items-center justify-center
            rounded-md opacity-80 hover:opacity-100
            focus-visible:outline-2 focus-visible:outline-white
          "
        >
          ✕
        </button>
      </div>
    </div>
  )
}
