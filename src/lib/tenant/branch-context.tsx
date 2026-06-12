import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { type Branch } from "@/lib/tenant/branches"
import { useBranches } from "@/lib/tenant/queries"

interface BranchState {
  branchId: string | null
  setBranchId: (id: string) => void
  branches: Branch[]
  loading: boolean
}

const Ctx = createContext<BranchState | undefined>(undefined)
const KEY = "branchId"

export function BranchProvider({ children }: { children: ReactNode }) {
  const { data: branches = [], isLoading } = useBranches()
  const [branchId, setBranchIdState] = useState<string | null>(() => localStorage.getItem(KEY))

  useEffect(() => {
    if (isLoading) return
    const valid = branchId && branches.some((b) => b.id === branchId)
    const next = valid ? branchId : (branches[0]?.id ?? null)
    if (next !== branchId) {
      setBranchIdState(next)
      if (next) localStorage.setItem(KEY, next)
    }
  }, [branches, isLoading, branchId])

  function setBranchId(id: string) {
    setBranchIdState(id)
    localStorage.setItem(KEY, id)
  }

  return (
    <Ctx.Provider value={{ branchId, setBranchId, branches, loading: isLoading }}>
      {children}
    </Ctx.Provider>
  )
}

export function useBranch(): BranchState {
  const c = useContext(Ctx)
  if (!c) throw new Error("useBranch must be used within BranchProvider")
  return c
}
