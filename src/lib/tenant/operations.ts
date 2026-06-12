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
export function validateNewWash(input: { package_id?: string; price?: number }): string | null {
  if (!input.package_id) return "package_required"
  if (input.price == null || Number.isNaN(input.price) || input.price <= 0) return "price_invalid"
  return null
}
