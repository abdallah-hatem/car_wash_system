/**
 * BranchSwitchToast — a self-contained, dependency-free toast that appears
 * when the user actively switches branches.
 *
 * RTL-safe: the toast is centered via start-1/2 + custom CSS keyframes that
 * apply the correct translateX direction per writing direction (LTR/RTL).
 * Tap-target-safe: no interaction required — auto-dismisses after 2500 ms.
 * No external toast library.
 *
 * Anti-initial-load-fire: a ref records whether the first stable branchId
 * assignment (the auto-select on load) has already been seen. Only changes
 * AFTER that are treated as user-initiated and trigger the toast.
 *
 * Usage: mount once inside BranchProvider (i.e. inside TenantLayoutInner).
 */
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { GitBranch } from "lucide-react"
import { useBranch } from "@/lib/tenant/branch-context"

const DISMISS_MS = 2500

export function BranchSwitchToast() {
  const { t } = useTranslation()
  const { branchId, branches, loading } = useBranch()

  /**
   * Phase tracking:
   *  - "waiting": still loading or branchId is null — haven't seen first real value yet.
   *  - "initialized": we've seen the first stable branchId (initial auto-select).
   *    Any subsequent change is user-initiated.
   */
  const phaseRef = useRef<"waiting" | "initialized">("waiting")
  const prevBranchIdRef = useRef<string | null>(null)

  const [visible, setVisible] = useState(false)
  const [branchName, setBranchName] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Still loading or no branch selected — nothing to do yet
    if (loading || !branchId) return

    if (phaseRef.current === "waiting") {
      // First stable value after load — this is the auto-selection, NOT user action.
      phaseRef.current = "initialized"
      prevBranchIdRef.current = branchId
      return
    }

    // Phase is "initialized" — any change here is genuinely user-initiated
    if (branchId !== prevBranchIdRef.current) {
      prevBranchIdRef.current = branchId

      const name = branches.find((b) => b.id === branchId)?.name ?? ""
      setBranchName(name)
      setVisible(true)

      // Reset the dismiss timer
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), DISMISS_MS)
    }
  }, [branchId, branches, loading])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      /**
       * Positioning: fixed bottom, horizontally centred using start-1/2.
       * The wf-toast CSS class carries the matching keyframe (LTR vs RTL)
       * defined in index.css, so the slide-up direction is always correct.
       */
      className="
        wf-toast
        fixed bottom-4 start-1/2
        z-[9998]
        flex items-center gap-2
        rounded-full
        bg-[#0d9488] text-white
        ps-4 pe-5 py-2.5
        shadow-lg
        text-sm font-medium
        pointer-events-none
      "
    >
      <GitBranch className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t("branch.nowViewing", { branch: branchName })}
    </div>
  )
}
