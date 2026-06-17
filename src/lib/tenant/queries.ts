import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import * as branches from "./branches"
import * as packages from "./packages"
import * as employees from "./employees"
import * as customers from "./customers"
import * as vehicles from "./vehicles"
import * as washOrders from "./wash-orders"
import * as payments from "./payments"
import * as dashboard from "./dashboard"
import * as users from "./users"
import { listWashes, listCustomerWashes, getWash, listWashesForStats, type WashFilters, type StatsFilters } from "./washes"
import { computeWashStats } from "./wash-stats"
import { PAGE_SIZE } from "@/lib/pagination"

export const keys = {
  branches: ["branches"] as const,
  packages: ["packages"] as const,
  employees: ["employees"] as const,
  customers: ["customers"] as const,
  vehiclesByCustomer: (id: string) => ["vehicles", "byCustomer", id] as const,
  plateSearch: (term: string) => ["vehicles", "search", term] as const,
  queue: (branchId: string) => ["queue", branchId] as const,
  dashboard: (branchId: string) => ["dashboard", branchId] as const,
  washes: ["washes"] as const,
  washStats: (f: StatsFilters) => ["washStats", f] as const,
  users: ["users"] as const,
}

// ─── Query hooks ────────────────────────────────────────────────────────────

export function useBranches() {
  return useQuery({ queryKey: keys.branches, queryFn: branches.listBranches })
}

export function usePackages() {
  return useQuery({ queryKey: keys.packages, queryFn: packages.listPackages })
}

export function useEmployees() {
  return useQuery({ queryKey: keys.employees, queryFn: employees.listEmployees })
}

export function useCustomers() {
  return useQuery({ queryKey: keys.customers, queryFn: customers.listCustomers })
}

export function useBranchesPaged(page: number) {
  return useQuery({ queryKey: ["branches", "page", page] as const, queryFn: () => branches.listBranchesPaged(page, PAGE_SIZE), placeholderData: keepPreviousData })
}

export function usePackagesPaged(page: number) {
  return useQuery({ queryKey: ["packages", "page", page] as const, queryFn: () => packages.listPackagesPaged(page, PAGE_SIZE), placeholderData: keepPreviousData })
}

export function useEmployeesPaged(page: number) {
  return useQuery({ queryKey: ["employees", "page", page] as const, queryFn: () => employees.listEmployeesPaged(page, PAGE_SIZE), placeholderData: keepPreviousData })
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: ["customers", "detail", id] as const,
    queryFn: () => customers.getCustomer(id!),
    enabled: !!id,
  })
}

export function useCustomersPaged(page: number, search = "") {
  return useQuery({
    queryKey: ["customers", "page", page, search] as const,
    queryFn: () => customers.listCustomersPaged(page, PAGE_SIZE, search),
    placeholderData: keepPreviousData,
  })
}

export function useVehiclesByCustomer(customerId: string | null) {
  return useQuery({
    queryKey: keys.vehiclesByCustomer(customerId ?? ""),
    queryFn: () => vehicles.listVehiclesByCustomer(customerId!),
    enabled: !!customerId,
  })
}

export function usePlateSearch(term: string) {
  return useQuery({
    queryKey: keys.plateSearch(term.trim()),
    queryFn: () => vehicles.searchVehiclesByPlate(term),
    enabled: term.trim().length > 0,
  })
}

export function useQueue(branchId: string | null) {
  return useQuery({
    queryKey: keys.queue(branchId ?? ""),
    queryFn: () => washOrders.listQueue(branchId!),
    enabled: !!branchId,
  })
}

export function useWashes(filters: WashFilters, page = 0) {
  return useQuery({ queryKey: [...keys.washes, filters, page], queryFn: () => listWashes(filters, page, PAGE_SIZE), placeholderData: keepPreviousData })
}

export function useCustomerWashes(customerId: string | null) {
  return useQuery({
    queryKey: ["washes", "byCustomer", customerId] as const,
    queryFn: () => listCustomerWashes(customerId!),
    enabled: !!customerId,
  })
}

export function useWash(id: string | null) {
  return useQuery({
    queryKey: ["washes", "detail", id] as const,
    queryFn: () => getWash(id!),
    enabled: !!id,
  })
}

export function useWashStats(filters: StatsFilters) {
  return useQuery({
    queryKey: keys.washStats(filters),
    queryFn: () => listWashesForStats(filters),
    // Aggregate in `select` so the heavy work is cached per query result and the
    // component receives a ready-to-render stats bundle (+ the capped flag).
    select: (res) => ({ stats: computeWashStats(res.washes), capped: res.capped }),
    placeholderData: keepPreviousData,
  })
}

export function useDashboard(branchId: string | null) {
  return useQuery({
    queryKey: keys.dashboard(branchId ?? ""),
    queryFn: () => dashboard.getTodayStats(branchId!),
    enabled: !!branchId,
  })
}

// Owner-only: the tenant's sub-users (managers). enabled-gated by the caller.
export function useUsers(enabled = true) {
  return useQuery({ queryKey: keys.users, queryFn: users.listUsers, enabled })
}

// ─── Mutation hooks ──────────────────────────────────────────────────────────

export function useBranchMutations() {
  const qc = useQueryClient()
  const inval = () => qc.invalidateQueries({ queryKey: keys.branches })
  return {
    create: useMutation({
      mutationFn: (a: { tenantId: string; input: Parameters<typeof branches.createBranch>[1] }) =>
        branches.createBranch(a.tenantId, a.input),
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Parameters<typeof branches.updateBranch>[1] }) =>
        branches.updateBranch(a.id, a.input),
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: (id: string) => branches.removeBranch(id),
      onSuccess: inval,
    }),
  }
}

export function usePackageMutations() {
  const qc = useQueryClient()
  const inval = () => qc.invalidateQueries({ queryKey: keys.packages })
  return {
    create: useMutation({
      mutationFn: (a: { tenantId: string; input: Parameters<typeof packages.createPackage>[1] }) =>
        packages.createPackage(a.tenantId, a.input),
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Parameters<typeof packages.updatePackage>[1] }) =>
        packages.updatePackage(a.id, a.input),
      onSuccess: inval,
    }),
    setActive: useMutation({
      mutationFn: (a: { id: string; is_active: boolean }) =>
        packages.setPackageActive(a.id, a.is_active),
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: (id: string) => packages.removePackage(id),
      onSuccess: inval,
    }),
  }
}

export function useEmployeeMutations() {
  const qc = useQueryClient()
  const inval = () => qc.invalidateQueries({ queryKey: keys.employees })
  return {
    create: useMutation({
      mutationFn: (a: { tenantId: string; input: Parameters<typeof employees.createEmployee>[1] }) =>
        employees.createEmployee(a.tenantId, a.input),
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Parameters<typeof employees.updateEmployee>[1] }) =>
        employees.updateEmployee(a.id, a.input),
      onSuccess: inval,
    }),
    setActive: useMutation({
      mutationFn: (a: { id: string; is_active: boolean }) =>
        employees.setEmployeeActive(a.id, a.is_active),
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: (id: string) => employees.removeEmployee(id),
      onSuccess: inval,
    }),
  }
}

export function useCustomerMutations() {
  const qc = useQueryClient()
  const inval = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keys.customers }),
      qc.invalidateQueries({ queryKey: ["vehicles"] }),
    ])
  return {
    create: useMutation({
      mutationFn: (a: { tenantId: string; input: Parameters<typeof customers.createCustomer>[1] }) =>
        customers.createCustomer(a.tenantId, a.input),
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Parameters<typeof customers.updateCustomer>[1] }) =>
        customers.updateCustomer(a.id, a.input),
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: (id: string) => customers.removeCustomer(id),
      onSuccess: inval,
    }),
  }
}

export function useVehicleMutations() {
  const qc = useQueryClient()
  const inval = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["vehicles"] }),
      qc.invalidateQueries({ queryKey: keys.customers }),
    ])
  return {
    create: useMutation({
      mutationFn: (a: { tenantId: string; input: Parameters<typeof vehicles.createVehicle>[1] }) =>
        vehicles.createVehicle(a.tenantId, a.input),
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: (a: { id: string; input: Parameters<typeof vehicles.updateVehicle>[1] }) =>
        vehicles.updateVehicle(a.id, a.input),
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: (id: string) => vehicles.removeVehicle(id),
      onSuccess: inval,
    }),
  }
}

export function useWashOrderMutations(branchId: string | null) {
  const qc = useQueryClient()
  const inval = () => {
    const bid = branchId ?? ""
    return Promise.all([
      qc.invalidateQueries({ queryKey: keys.queue(bid) }),
      qc.invalidateQueries({ queryKey: keys.dashboard(bid) }),
      qc.invalidateQueries({ queryKey: keys.washes }),
    ])
  }
  return {
    create: useMutation({
      mutationFn: (a: { tenantId: string; input: Parameters<typeof washOrders.createWashOrder>[1] }) =>
        washOrders.createWashOrder(a.tenantId, a.input),
      onSuccess: inval,
    }),
    start: useMutation({
      mutationFn: (a: { id: string; employeeId: string | null }) =>
        washOrders.startWashOrder(a.id, a.employeeId),
      onSuccess: inval,
    }),
    complete: useMutation({
      mutationFn: (id: string) => washOrders.completeWashOrder(id),
      onSuccess: inval,
    }),
    cancel: useMutation({
      mutationFn: (a: { id: string; reason: string }) => washOrders.cancelWashOrder(a.id, a.reason),
      onSuccess: inval,
    }),
  }
}

export function useUserMutations() {
  const qc = useQueryClient()
  const inval = () => qc.invalidateQueries({ queryKey: keys.users })
  return {
    create: useMutation({
      mutationFn: (input: users.CreateUserInput) => users.createUser(input),
      onSuccess: inval,
    }),
    update: useMutation({
      mutationFn: (input: users.UpdateUserInput) => users.updateUser(input),
      onSuccess: inval,
    }),
    setActive: useMutation({
      mutationFn: (a: { userId: string; isActive: boolean }) => users.setUserActive(a.userId, a.isActive),
      onSuccess: inval,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => users.deleteUser(userId),
      onSuccess: inval,
    }),
    resetPassword: useMutation({
      mutationFn: (a: { userId: string; password: string }) => users.resetUserPassword(a.userId, a.password),
    }),
  }
}

export function usePaymentMutations(branchId: string | null) {
  const qc = useQueryClient()
  const inval = () => {
    const bid = branchId ?? ""
    return Promise.all([
      qc.invalidateQueries({ queryKey: keys.queue(bid) }),
      qc.invalidateQueries({ queryKey: keys.dashboard(bid) }),
      qc.invalidateQueries({ queryKey: keys.washes }),
    ])
  }
  return {
    record: useMutation({
      mutationFn: (a: { tenantId: string; washOrderId: string; input: Parameters<typeof payments.recordPayment>[2] }) =>
        payments.recordPayment(a.tenantId, a.washOrderId, a.input),
      onSuccess: inval,
    }),
  }
}
