/**
 * Hook: manages PWA update state.
 *
 * Initialises the SW registration once on mount and exposes:
 *   showBanner — whether to render PwaUpdateBanner
 *   reload     — call to activate the waiting SW and reload
 *   dismiss    — call to hide the banner without reloading
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { initPWA } from "@/pwa"

export function usePwaUpdate() {
  const [showBanner, setShowBanner] = useState(false)
  const reloadRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const reloadFn = initPWA(() => setShowBanner(true))
    reloadRef.current = reloadFn
  }, [])

  const reload = useCallback(() => {
    reloadRef.current?.()
  }, [])

  const dismiss = useCallback(() => {
    setShowBanner(false)
  }, [])

  return { showBanner, reload, dismiss }
}
