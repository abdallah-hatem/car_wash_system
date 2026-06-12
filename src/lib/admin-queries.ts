import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listBusinesses, setBusinessStatus, createBusiness } from "./admin"
import type { CreateBusinessInput } from "./admin"

const businessesKey = ["businesses"] as const

export function useBusinesses() {
  return useQuery({ queryKey: businessesKey, queryFn: listBusinesses })
}

export function useBusinessMutations() {
  const qc = useQueryClient()
  const inval = () => qc.invalidateQueries({ queryKey: businessesKey })
  return {
    create: useMutation({
      mutationFn: (input: CreateBusinessInput) => createBusiness(input),
      onSuccess: inval,
    }),
    setStatus: useMutation({
      mutationFn: (a: { id: string; status: "active" | "suspended" }) =>
        setBusinessStatus(a.id, a.status),
      onSuccess: inval,
    }),
  }
}
