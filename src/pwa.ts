/**
 * PWA service-worker registration + controlled update banner.
 *
 * Uses the `prompt` registerType so we can show a localised "New version
 * available — Reload" banner and only reload when the user clicks the button
 * (avoids interrupting an operator mid-flow).
 *
 * The i18n translations for the toast live in:
 *   en: pwa.updateAvailable / pwa.reload
 *   ar: pwa.updateAvailable / pwa.reload
 */
import { registerSW } from "virtual:pwa-register"

export function initPWA(showUpdateToast: () => void): () => void {
  // In dev, never register a service worker — and proactively unregister any
  // stale one (e.g. left over from when devOptions was enabled) and drop its
  // caches, so HMR is never served a cached bundle (the "my fix doesn't show"
  // bug). The SW is only active in production builds.
  if (import.meta.env.DEV) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {})
      if (typeof caches !== "undefined") {
        caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k))).catch(() => {})
      }
    }
    return () => {}
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      // A new SW is waiting — tell the app to show the update banner.
      showUpdateToast()
    },
    onOfflineReady() {
      // App is fully cached and ready to work offline.
    },
  })

  // Expose a callable that the banner "Reload" button uses.
  return () => {
    updateSW(true)
  }
}
