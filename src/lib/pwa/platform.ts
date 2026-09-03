/**
 * Which phone is this, and are we already installed.
 *
 * Kept in one file because two answers to "is this an iPhone" is how one of
 * them goes stale — iPadOS in particular reports itself as a Mac, so the touch
 * check below is load-bearing rather than defensive.
 */

/** iPhone/iPad, including iPadOS which reports itself as a Mac. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return ua.includes("Macintosh") && navigator.maxTouchPoints > 1
}

/** Running from the home screen rather than in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own flag; it does not implement the display-mode query.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
