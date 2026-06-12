import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Plus, Trash2 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { BranchDialog } from "@/components/tenant/BranchDialog"
import { listBranches, removeBranch, type Branch } from "@/lib/tenant/branches"

export default function BranchesPage() {
  const { t, i18n } = useTranslation()

  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function fetchBranches() {
    setLoading(true)
    setError(null)
    try {
      const data = await listBranches()
      setBranches(data)
    } catch {
      setError(t("branches.errors.generic"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchBranches()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleNew() {
    setEditing(null)
    setDialogOpen(true)
  }

  function handleEdit(branch: Branch) {
    setEditing(branch)
    setDialogOpen(true)
  }

  async function handleDelete(branch: Branch) {
    if (!window.confirm(t("common.confirmDelete"))) return
    setDeletingId(branch.id)
    setDeleteError(null)
    try {
      await removeBranch(branch.id)
      await fetchBranches()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "generic"
      if (msg === "in_use") {
        setDeleteError(t("branches.errors.in_use"))
      } else {
        setDeleteError(t("branches.errors.generic"))
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{t("branches.title")}</h1>
        <Button onClick={handleNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t("branches.newBranch")}
        </Button>
      </div>

      {deleteError && (
        <p role="alert" className="text-sm text-destructive">{deleteError}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : error ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchBranches} className="min-h-[44px] w-fit">
            {t("common.retry")}
          </Button>
        </div>
      ) : branches.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("branches.empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">{t("branches.name")}</TableHead>
                <TableHead className="text-start">{t("branches.address")}</TableHead>
                <TableHead className="text-start">{t("branches.created")}</TableHead>
                <TableHead className="text-start">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.address ?? "—"}</TableCell>
                  <TableCell>
                    {new Date(branch.created_at).toLocaleDateString(i18n.language)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleEdit(branch)}
                        aria-label={t("common.edit")}
                        title={t("common.edit")}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={deletingId === branch.id}
                        onClick={() => handleDelete(branch)}
                        aria-label={t("common.delete")}
                        title={t("common.delete")}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <BranchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        branch={editing}
        onSaved={fetchBranches}
      />
    </div>
  )
}
