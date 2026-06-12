import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { listBranches, type Branch } from "@/lib/tenant/branches"

interface BranchState { branchId: string | null; setBranchId: (id: string) => void; branches: Branch[]; loading: boolean }
const Ctx = createContext<BranchState | undefined>(undefined)
const KEY = "branchId"

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listBranches().then((bs) => {
      setBranches(bs)
      const stored = localStorage.getItem(KEY)
      const valid = stored && bs.some((b) => b.id === stored) ? stored : (bs[0]?.id ?? null)
      setBranchIdState(valid)
      if (valid) localStorage.setItem(KEY, valid)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function setBranchId(id: string) { setBranchIdState(id); localStorage.setItem(KEY, id) }
  return <Ctx.Provider value={{ branchId, setBranchId, branches, loading }}>{children}</Ctx.Provider>
}
export function useBranch(): BranchState {
  const c = useContext(Ctx)
  if (!c) throw new Error("useBranch must be used within BranchProvider")
  return c
}
