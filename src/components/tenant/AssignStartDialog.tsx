import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
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
import { listEmployees, type Employee } from "@/lib/tenant/employees"

const NO_EMPLOYEE_VALUE = "__none__"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (employeeId: string | null) => void
  loading?: boolean
}

export function AssignStartDialog({ open, onOpenChange, onConfirm, loading = false }: Props) {
  const { t } = useTranslation()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selected, setSelected] = useState<string>(NO_EMPLOYEE_VALUE)
  const [fetching, setFetching] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(NO_EMPLOYEE_VALUE)
    setFetching(true)
    listEmployees()
      .then((all) => setEmployees(all.filter((e) => e.is_active)))
      .catch(() => setEmployees([]))
      .finally(() => setFetching(false))
  }, [open])

  function handleConfirm() {
    const empId = selected === NO_EMPLOYEE_VALUE ? null : selected
    onConfirm(empId)
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
            <Select value={selected} onValueChange={setSelected} disabled={fetching || loading}>
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
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="min-h-[44px]"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={fetching || loading}
            className="min-h-[44px]"
          >
            {t("wash.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
