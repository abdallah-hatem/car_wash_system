import { supabase } from "@/lib/supabase"
import type { WashStatus } from "./operations"
import { dayRangeToBounds } from "./duration"
import { pageToRange, PAGE_SIZE } from "@/lib/pagination"

export interface WashFilters {
  branchId: string | "all"
  status: WashStatus | "all"
  employeeId: string | "all"
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

export interface WashRow {
  id: string
  status: WashStatus
  price: number
  created_at: string
  started_at: string | null
  completed_at: string | null
  plate_number: string | null
  customer_name: string | null
  package_name: string | null
  employee_name: string | null
  branch_name: string | null
  cancellation_reason: string | null
  payments: { amount: number }[]
}

/** @deprecated No longer used for fetching; kept for any legacy import references */
export const WASHES_LIMIT = 200

const SELECT =
  "id,status,price,created_at,started_at,completed_at,cancellation_reason," +
  "vehicles(plate_number),customers(name),packages(name),employees(name),branches(name),payments(amount)"

export async function listWashes(f: WashFilters, page = 0, pageSize = PAGE_SIZE): Promise<{ rows: WashRow[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)
  const { fromISO, toISO } = dayRangeToBounds(f.from, f.to)
  let q = supabase.from("wash_orders").select(SELECT, { count: "exact" })
    .gte("created_at", fromISO).lte("created_at", toISO)
  if (f.branchId !== "all") q = q.eq("branch_id", f.branchId)
  if (f.status !== "all") q = q.eq("status", f.status)
  if (f.employeeId !== "all") q = q.eq("assigned_employee_id", f.employeeId)
  q = q.order("created_at", { ascending: false }).range(from, to)
  const { data, count, error } = await q
  if (error) throw error
  const rows = ((data ?? []) as unknown as Array<{
    id: string
    status: WashStatus
    price: number
    created_at: string
    started_at: string | null
    completed_at: string | null
    cancellation_reason: string | null
    vehicles: { plate_number: string } | null
    customers: { name: string } | null
    packages: { name: string } | null
    employees: { name: string } | null
    branches: { name: string } | null
    payments: { amount: number }[]
  }>).map((o) => ({
    id: o.id,
    status: o.status,
    price: Number(o.price),
    created_at: o.created_at,
    started_at: o.started_at,
    completed_at: o.completed_at,
    cancellation_reason: o.cancellation_reason,
    plate_number: o.vehicles?.plate_number ?? null,
    customer_name: o.customers?.name ?? null,
    package_name: o.packages?.name ?? null,
    employee_name: o.employees?.name ?? null,
    branch_name: o.branches?.name ?? null,
    payments: (o.payments ?? []).map((p) => ({ amount: Number(p.amount) })),
  }))
  return { rows, total: count ?? 0 }
}
