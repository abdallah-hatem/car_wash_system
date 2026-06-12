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

// Revenue query approach: FALLBACK — fetch today's order ids for the branch,
// then query payments filtered by those ids and sum. This avoids the
// nested `.eq("wash_orders.branch_id", …)` filter which is awkward with the
// generated types and may not be supported as a filtering inner join in
// supabase-js v2. This guarantees correct, branch-scoped revenue.
export async function getTodayStats(branchId: string): Promise<DayStats> {
  const since = startOfDay(new Date()).toISOString()

  // Step 1: today's orders for this branch → count + status breakdown
  const { data: orders, error: oErr } = await supabase
    .from("wash_orders")
    .select("id,status")
    .eq("branch_id", branchId)
    .gte("created_at", since)
  if (oErr) throw oErr

  const list = (orders ?? []) as { id: string; status: WashStatus }[]
  const orderIds = list.map((o) => o.id)

  // Step 2: revenue — today's payments for those order ids
  let revenue = 0
  if (orderIds.length > 0) {
    const { data: pays, error: pErr } = await supabase
      .from("payments")
      .select("amount")
      .in("wash_order_id", orderIds)
    if (pErr) throw pErr
    revenue = sumPayments((pays ?? []) as unknown as { amount: number }[])
  }

  return { revenue, washesToday: list.length, counts: summarizeStatuses(list) }
}
