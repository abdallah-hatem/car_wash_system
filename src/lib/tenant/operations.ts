export type WashStatus = "waiting" | "in_progress" | "done" | "cancelled"

export const ALLOWED_TRANSITIONS: Record<WashStatus, WashStatus[]> = {
  waiting: ["in_progress", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: [],
  cancelled: [],
}
export function canTransition(from: WashStatus, to: WashStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false
}
export function amountPaid(payments: { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount), 0)
}
export function isPaid(price: number, payments: { amount: number }[]): boolean {
  return amountPaid(payments) >= Number(price)
}
export function remaining(price: number, payments: { amount: number }[]): number {
  return Math.max(0, Number(price) - amountPaid(payments))
}
export function validateNewWash(input: {
  package_id?: string
  price?: number
  vehicle_id?: string | null
  has_new_vehicle?: boolean
}): string | null {
  if (!input.package_id) return "package_required"
  if (input.price == null || Number.isNaN(input.price) || input.price <= 0) return "price_invalid"
  if (!input.vehicle_id && !input.has_new_vehicle) return "vehicle_required"
  return null
}

export function validateCancelReason(reason: string): boolean {
  return reason.trim().length > 0
}

/**
 * A wash can only go in_progress with an assigned staff member.
 * Returns an error key when no employee is selected, else null.
 */
export function validateStart(employeeId: string | null | undefined): string | null {
  return employeeId ? null : "employee_required"
}

/**
 * Staff selectable for a wash at a given branch: active employees assigned to that
 * branch, plus unassigned "floater" staff (branch_id null) who can work anywhere.
 */
export function availableEmployees<T extends { is_active: boolean; branch_id: string | null }>(
  employees: T[],
  branchId: string | null,
): T[] {
  return employees.filter(
    (e) => e.is_active && (e.branch_id === branchId || e.branch_id === null),
  )
}

/**
 * Whether a branch has at least one active staff member at all.
 * Gates creating a new wash: with zero staff the wash could never be started
 * (a wash can't go in_progress without an assigned employee), so we block
 * creation up front. Washes CAN still be queued when staff exist but are all
 * busy — they wait until a free staff member is assigned.
 */
export function hasActiveStaff<T extends { is_active: boolean; branch_id: string | null }>(
  employees: T[],
  branchId: string | null,
): boolean {
  return availableEmployees(employees, branchId).length > 0
}

/**
 * Set of employee ids currently occupied by an in-progress wash. Such staff are
 * "busy" — shown in the Start picker but not selectable until their wash is done.
 */
export function busyEmployeeIds(
  orders: { status: string; assigned_employee_id: string | null }[],
): Set<string> {
  return new Set(
    orders
      .filter((o) => o.status === "in_progress" && o.assigned_employee_id)
      .map((o) => o.assigned_employee_id as string),
  )
}
