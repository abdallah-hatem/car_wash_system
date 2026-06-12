import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listBusinesses, listBusinessesPaged, setBusinessStatus, createBusiness } from "./admin"
import type { CreateBusinessInput } from "./admin"
import { PAGE_SIZE } from "./pagination"

const businessesKey = ["businesses"] as const

export function useBusinesses() {
  return useQuery({ queryKey: businessesKey, queryFn: listBusinesses })
}

export function useBusinessesPaged(page: number) {
  return useQuery({ queryKey: ["businesses", "page", page] as const, queryFn: () => listBusinessesPaged(page, PAGE_SIZE) })
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
