import { supabase } from "@/lib/supabase"
import type { WashStatus } from "./operations"
import { dayRangeToBounds } from "./duration"
import { pageToRange, PAGE_SIZE } from "@/lib/pagination"
import { normalizePlateSearch } from "./plate"

/** Escape LIKE special characters: \, %, _ */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&")
}

export interface WashFilters {
  branchId: string | "all"
  status: WashStatus | "all"
  employeeId: string | "all"
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
  plate?: string
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

const SELECT_LEFT =
  "id,status,price,created_at,started_at,completed_at,cancellation_reason," +
  "vehicles(plate_number),customers(name),packages(name),employees(name),branches(name),payments(amount)"

const SELECT_INNER =
  "id,status,price,created_at,started_at,completed_at,cancellation_reason," +
  "vehicles!inner(plate_number),customers(name),packages(name),employees(name),branches(name),payments(amount)"

export async function listWashes(f: WashFilters, page = 0, pageSize = PAGE_SIZE): Promise<{ rows: WashRow[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)
  const { fromISO, toISO } = dayRangeToBounds(f.from, f.to)

  const plateTrim = f.plate?.trim() ?? ""
  const hasPlate = plateTrim.length > 0

  let q = supabase
    .from("wash_orders")
    .select(hasPlate ? SELECT_INNER : SELECT_LEFT, { count: "exact" })
    .gte("created_at", fromISO)
    .lte("created_at", toISO)

  if (f.branchId !== "all") q = q.eq("branch_id", f.branchId)
  if (f.status !== "all") q = q.eq("status", f.status)
  if (f.employeeId !== "all") q = q.eq("assigned_employee_id", f.employeeId)
  if (hasPlate) {
    const norm = normalizePlateSearch(plateTrim)
    const esc = escapeLike(norm)
    q = q.ilike("vehicles.plate_number", `%${esc}%`)
  }
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

// ─── Customer wash history ────────────────────────────────────────────────────

export interface CustomerWashRow {
  id: string
  status: WashStatus
  price: number
  created_at: string
  plate_number: string | null
  package_name: string | null
  branch_name: string | null
  payments: { amount: number }[]
}

const SELECT_CUSTOMER_WASHES =
  "id,status,price,created_at," +
  "vehicles(plate_number),packages(name),branches(name),payments(amount)"

export async function listCustomerWashes(
  customerId: string,
  limit = 20,
): Promise<CustomerWashRow[]> {
  const { data, error } = await supabase
    .from("wash_orders")
    .select(SELECT_CUSTOMER_WASHES)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return ((data ?? []) as unknown as Array<{
    id: string
    status: WashStatus
    price: number
    created_at: string
    vehicles: { plate_number: string } | null
    packages: { name: string } | null
    branches: { name: string } | null
    payments: { amount: number }[]
  }>).map((o) => ({
    id: o.id,
    status: o.status,
    price: Number(o.price),
    created_at: o.created_at,
    plate_number: o.vehicles?.plate_number ?? null,
    package_name: o.packages?.name ?? null,
    branch_name: o.branches?.name ?? null,
    payments: (o.payments ?? []).map((p) => ({ amount: Number(p.amount) })),
  }))
}
