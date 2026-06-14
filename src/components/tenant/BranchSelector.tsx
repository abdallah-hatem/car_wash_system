/**
 * BranchSelector
 *
 * Navbar control for switching the active branch.
 *  - Subtly distinct (muted) background + branch icon so it reads as a
 *    context control, without a loud tint.
 *  - The focus ring is keyboard-only (`focus-visible`), so a mouse selection
 *    doesn't leave the trigger looking "stuck focused".
 *  - Tap target ≥ 44px, RTL-safe (logical utilities).
 *
 * Feedback on switching is handled by <BranchSwitchToast/> ("Now viewing …").
 */
import { useTranslation } from "react-i18next"
import { GitBranch } from "lucide-react"
import { useBranch } from "@/lib/tenant/branch-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function BranchSelector() {
  const { t } = useTranslation()
  const { branchId, setBranchId, branches, loading } = useBranch()

  if (loading) return null

  if (branches.length <= 1) {
    const name = branches[0]?.name
    if (!name) return null
    return (
      <span className="text-sm text-muted-foreground px-2 min-h-[44px] flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {name}
      </span>
    )
  }

  return (
    <Select value={branchId ?? ""} onValueChange={(id) => setBranchId(id)}>
      <SelectTrigger
        className="
          min-h-[44px] w-auto min-w-[90px] max-w-[160px] shrink gap-1.5 text-sm
          bg-muted/60 hover:bg-muted border-border
          focus:outline-none focus:ring-0 focus:ring-offset-0
          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          transition-colors
        "
        aria-label={t("queue.branch")}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <SelectValue placeholder={t("queue.branch")} />
      </SelectTrigger>
      <SelectContent>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
