export function validateBranch(input: { name?: string }): string | null {
  if (!input.name?.trim()) return "name_required"
  return null
}
export function validatePackage(input: { name?: string; price?: number }): string | null {
  if (!input.name?.trim()) return "name_required"
  if (input.price == null || Number.isNaN(input.price) || input.price <= 0) return "price_invalid"
  return null
}
export function validateEmployee(input: { name?: string }): string | null {
  if (!input.name?.trim()) return "name_required"
  return null
}
