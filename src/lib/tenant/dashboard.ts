import { supabase } from "@/lib/supabase"
import type { WashStatus } from "./operations"

export function sumPayments(payments: { amount: number }[]): number {
  return payments.reduce((s, p) => s + Number(p.amount), 0)
}

export function summarizeStatuses(orders: { status: WashStatus }[]): Record<WashStatus, number> {
  const counts: Record<WashStatus, number> = { waiting: 0, in_progress: 0, done: 0, cancelled: 0 }
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1
  return counts
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

export interface DayStats {
  revenue: number
  washesToday: number
  counts: Record<WashStatus, number>
}

export async function getTodayStats(branchId: string): Promise<DayStats> {
  const since = startOfDay(new Date()).toISOString()

  // Revenue = payments RECORDED today (paid_at >= local midnight) for this branch.
  // We embed wash_orders(branch_id) and filter by branch client-side, rather than a
  // server-side nested `.eq("wash_orders.branch_id", …)` (awkward/untyped in supabase-js v2).
  // Filtering by paid_at (not order date) correctly captures payments made today on
  // older unpaid-done orders — which 3C keeps payable across days.
  const { data: pays, error: pErr } = await supabase
    .from("payments")
    .select("amount,wash_orders!inner(branch_id)")
    .gte("paid_at", since)
  if (pErr) throw pErr
  const branchPays = ((pays ?? []) as unknown as { amount: number; wash_orders: { branch_id: string } | null }[])
    .filter((p) => p.wash_orders?.branch_id === branchId)
  const revenue = sumPayments(branchPays)

  // Today's orders for this branch → count + status breakdown
  const { data: orders, error: oErr } = await supabase
    .from("wash_orders")
    .select("status,created_at")
    .eq("branch_id", branchId)
    .gte("created_at", since)
  if (oErr) throw oErr
  const list = (orders ?? []) as { status: WashStatus }[]

  return { revenue, washesToday: list.length, counts: summarizeStatuses(list) }
}
