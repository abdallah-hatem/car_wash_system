import { normalizePlateLetters, normalizePlateDigits } from "./plate"

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
export function validateCustomer(input: { name?: string }): string | null {
  if (!input.name?.trim()) return "name_required"
  return null
}
export function validateVehicle(input: { plate_number?: string }): string | null {
  if (!input.plate_number?.trim()) return "plate_required"
  return null
}

export function validateEgyptianPlate(input: { letters?: string; digits?: string }): string | null {
  const letters = normalizePlateLetters(input.letters ?? "")
  if (letters.length !== 3) return "letters_required"
  const digits = normalizePlateDigits(input.digits ?? "")
  if (digits.length < 1 || digits.length > 4) return "digits_required"
  return null
}
