/**
 * BranchFilter — in-page branch picker for the branch-specific tabs (Queue,
 * Dashboard). Reads/sets the shared branch context, so picking a branch on one
 * tab carries to the other. Renders nothing when the user has a single branch
 * (single-branch tenants and members locked to one branch never see it).
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

export function BranchFilter() {
  const { t } = useTranslation()
  const { branchId, setBranchId, branches, loading } = useBranch()

  if (loading || branches.length <= 1) return null

  return (
    <Select value={branchId ?? ""} onValueChange={setBranchId}>
      <SelectTrigger
        className="min-h-[44px] w-auto min-w-[150px] max-w-[220px] gap-1.5 text-sm"
        aria-label={t("queue.branch")}
      >
        <GitBranch className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <SelectValue placeholder={t("queue.branch")} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
