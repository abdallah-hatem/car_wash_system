import type { WashStatus } from "@/lib/tenant/operations"

/**
 * Returns Tailwind utility classes for a wash-status pill badge.
 * All classes are RTL-safe (no physical direction utilities).
 * Usage: <Badge variant="outline" className={statusBadgeClass(status)} />
 */
export function statusBadgeClass(status: WashStatus): string {
  switch (status) {
    case "waiting":
      return "bg-amber-100 text-amber-800 border-amber-200"
    case "in_progress":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "done":
      return "bg-green-100 text-green-800 border-green-200"
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-200"
    default:
      return "bg-secondary text-secondary-foreground border-transparent"
  }
}
