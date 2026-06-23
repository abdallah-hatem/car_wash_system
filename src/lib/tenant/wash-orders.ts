import { supabase } from "@/lib/supabase"

export interface QueueOrder {
  id: string; status: "waiting" | "in_progress" | "done" | "cancelled"; price: number; notes: string | null
  created_at: string; assigned_employee_id: string | null
  plate_number: string | null; customer_name: string | null; package_name: string | null
  employee_name: string | null; payments: { amount: number }[]
}

const SELECT =
  "id,status,price,notes,created_at,assigned_employee_id," +
  "vehicles(plate_number),customers(name),packages(name),employees(name),payments(amount)"

export async function listQueue(branchId: string): Promise<QueueOrder[]> {
  // active orders (waiting/in_progress) regardless of day + today's done/cancelled
  const { data, error } = await supabase.from("wash_orders").select(SELECT)
    .eq("branch_id", branchId).order("created_at", { ascending: true })
  if (error) throw error
  return ((data ?? []) as unknown as Array<{
    id: string
    status: "waiting" | "in_progress" | "done" | "cancelled"
    price: number
    notes: string | null
    created_at: string
    assigned_employee_id: string | null
    vehicles: { plate_number: string } | null
    customers: { name: string } | null
    packages: { name: string } | null
    employees: { name: string } | null
    payments: { amount: number }[]
  }>).map((o) => ({
    id: o.id, status: o.status, price: Number(o.price), notes: o.notes, created_at: o.created_at,
    assigned_employee_id: o.assigned_employee_id,
    plate_number: o.vehicles?.plate_number ?? null, customer_name: o.customers?.name ?? null,
    package_name: o.packages?.name ?? null, employee_name: o.employees?.name ?? null,
    payments: (o.payments ?? []).map((p) => ({ amount: Number(p.amount) })),
  }))
}
export async function createWashOrder(tenantId: string, input: {
  branch_id: string; price: number; package_id: string | null; vehicle_id: string | null
  customer_id: string | null; notes: string | null
}): Promise<string> {
  const { data, error } = await supabase.from("wash_orders").insert({
    tenant_id: tenantId, branch_id: input.branch_id, price: input.price, status: "waiting",
    package_id: input.package_id, vehicle_id: input.vehicle_id, customer_id: input.customer_id, notes: input.notes,
  }).select("id").single()
  if (error) throw error
  return data.id
}
// A wash can only start with an assigned staff member (DB CHECK constraint
// wash_orders_in_progress_needs_employee enforces this too).
export async function startWashOrder(id: string, employeeId: string): Promise<void> {
  if (!employeeId) throw new Error("employee_required")
  const { error } = await supabase.from("wash_orders")
    .update({ status: "in_progress", started_at: new Date().toISOString(), assigned_employee_id: employeeId }).eq("id", id)
  if (error) throw error
}
export async function completeWashOrder(id: string): Promise<void> {
  const { error } = await supabase.from("wash_orders")
    .update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id)
  if (error) throw error
}
export async function cancelWashOrder(id: string, reason: string): Promise<void> {
  const { error } = await supabase.from("wash_orders")
    .update({ status: "cancelled", cancellation_reason: reason.trim(), cancelled_at: new Date().toISOString() })
    .eq("id", id)
  if (error) throw error
}
