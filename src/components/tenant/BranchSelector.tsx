import { useTranslation } from "react-i18next"
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
      <span className="text-sm text-muted-foreground px-2 min-h-[44px] flex items-center">
        {name}
      </span>
    )
  }

  return (
    <Select value={branchId ?? ""} onValueChange={setBranchId}>
      <SelectTrigger
        className="min-h-[44px] w-auto min-w-[120px] text-sm"
        aria-label={t("queue.branch")}
      >
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
