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

// ─── Analytics / stats fetch ────────────────────────────────────────────────────

import type { StatsWash } from "./wash-stats"

export interface StatsFilters {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  branchId: string | "all"
}

export interface StatsResult {
  washes: StatsWash[]
  /** True when the row cap was reached, so the dataset may be incomplete. */
  capped: boolean
}

/** Hard cap on rows pulled for analytics (no pagination — we aggregate client-side). */
export const STATS_LIMIT = 5000

const SELECT_STATS =
  "id,status,price,created_at,started_at,completed_at,cancelled_at,cancellation_reason," +
  "packages(name),branches(name),employees(name),payments(amount,paid_at)"

/**
 * Fetch ALL washes in a date range (optionally one branch) for the analytics page.
 * No pagination — capped at STATS_LIMIT rows. RLS scopes to the caller's tenant.
 * Returns flattened StatsWash records the pure aggregation module consumes, plus a
 * `capped` flag the UI surfaces when the cap is hit.
 */
export async function listWashesForStats(f: StatsFilters): Promise<StatsResult> {
  const { fromISO, toISO } = dayRangeToBounds(f.from, f.to)

  let q = supabase
    .from("wash_orders")
    .select(SELECT_STATS)
    .gte("created_at", fromISO)
    .lte("created_at", toISO)

  if (f.branchId !== "all") q = q.eq("branch_id", f.branchId)

  q = q.order("created_at", { ascending: false }).limit(STATS_LIMIT)
  const { data, error } = await q
  if (error) throw error

  const rows = (data ?? []) as unknown as Array<{
    id: string
    status: WashStatus
    price: number
    created_at: string
    started_at: string | null
    completed_at: string | null
    cancelled_at: string | null
    cancellation_reason: string | null
    packages: { name: string } | null
    branches: { name: string } | null
    employees: { name: string } | null
    payments: { amount: number; paid_at: string }[]
  }>

  const washes: StatsWash[] = rows.map((o) => ({
    id: o.id,
    status: o.status,
    price: Number(o.price),
    created_at: o.created_at,
    started_at: o.started_at,
    completed_at: o.completed_at,
    cancelled_at: o.cancelled_at,
    cancellation_reason: o.cancellation_reason,
    package_name: o.packages?.name ?? null,
    branch_name: o.branches?.name ?? null,
    employee_name: o.employees?.name ?? null,
    payments: (o.payments ?? []).map((p) => ({
      amount: Number(p.amount),
      paid_at: p.paid_at,
    })),
  }))

  return { washes, capped: washes.length >= STATS_LIMIT }
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

// ─── Single wash detail ───────────────────────────────────────────────────────

export interface WashPayment {
  amount: number
  method: "cash" | "card" | "transfer"
  paid_at: string
}

export interface WashDetail {
  id: string
  status: WashStatus
  price: number
  notes: string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  // vehicle
  plate_number: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_color: string | null
  // customer
  customer_id: string | null
  customer_name: string | null
  customer_phone: string | null
  // package / employee / branch
  package_name: string | null
  employee_name: string | null
  branch_name: string | null
  // payments (full detail)
  payments: WashPayment[]
}

const SELECT_DETAIL =
  "id,status,price,notes,created_at,started_at,completed_at,cancelled_at,cancellation_reason," +
  "customer_id," +
  "vehicles(plate_number,make,model,color)," +
  "customers(name,phone)," +
  "packages(name)," +
  "employees(name)," +
  "branches(name)," +
  "payments(amount,method,paid_at)"

export async function getWash(id: string): Promise<WashDetail | null> {
  const { data, error } = await supabase
    .from("wash_orders")
    .select(SELECT_DETAIL)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const o = data as unknown as {
    id: string
    status: WashStatus
    price: number
    notes: string | null
    created_at: string
    started_at: string | null
    completed_at: string | null
    cancelled_at: string | null
    cancellation_reason: string | null
    customer_id: string | null
    vehicles: { plate_number: string; make: string | null; model: string | null; color: string | null } | null
    customers: { name: string; phone: string | null } | null
    packages: { name: string } | null
    employees: { name: string } | null
    branches: { name: string } | null
    payments: { amount: number; method: "cash" | "card" | "transfer"; paid_at: string }[]
  }
  return {
    id: o.id,
    status: o.status,
    price: Number(o.price),
    notes: o.notes,
    created_at: o.created_at,
    started_at: o.started_at,
    completed_at: o.completed_at,
    cancelled_at: o.cancelled_at,
    cancellation_reason: o.cancellation_reason,
    customer_id: o.customer_id,
    plate_number: o.vehicles?.plate_number ?? null,
    vehicle_make: o.vehicles?.make ?? null,
    vehicle_model: o.vehicles?.model ?? null,
    vehicle_color: o.vehicles?.color ?? null,
    customer_name: o.customers?.name ?? null,
    customer_phone: o.customers?.phone ?? null,
    package_name: o.packages?.name ?? null,
    employee_name: o.employees?.name ?? null,
    branch_name: o.branches?.name ?? null,
    payments: (o.payments ?? []).map((p) => ({
      amount: Number(p.amount),
      method: p.method,
      paid_at: p.paid_at,
    })),
  }
}
