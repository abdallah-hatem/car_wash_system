import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Play } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useEmployees } from "@/lib/tenant/queries"
import { availableEmployees } from "@/lib/tenant/operations"

const NO_EMPLOYEE_VALUE = "__none__"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (employeeId: string | null) => void
  branchId: string
  loading?: boolean
}

export function AssignStartDialog({ open, onOpenChange, onConfirm, branchId, loading = false }: Props) {
  const { t } = useTranslation()
  const { data: all = [], isLoading } = useEmployees()
  const [selected, setSelected] = useState<string>(NO_EMPLOYEE_VALUE)

  // Only active staff for the selected branch (plus unassigned floaters).
  const employees = availableEmployees(all, branchId)

  useEffect(() => {
    if (open) setSelected(NO_EMPLOYEE_VALUE)
  }, [open])

  function handleConfirm() {
    onConfirm(selected === NO_EMPLOYEE_VALUE ? null : selected)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>{t("wash.assignEmployee")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-employee">{t("wash.assignEmployee")}</Label>
            <Select value={selected} onValueChange={setSelected} disabled={isLoading || loading}>
              <SelectTrigger id="assign-employee" className="min-h-[44px]">
                <SelectValue placeholder={t("wash.noEmployee")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EMPLOYEE_VALUE}>{t("wash.noEmployee")}</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoading && employees.length === 0 && (
              <p className="text-xs text-muted-foreground">{t("wash.noStaffAtBranch")}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading || loading}
            className="gap-1.5"
          >
            {!loading && <Play className="h-4 w-4" />}
            {t("wash.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
