/** Normalize a plate for display/search: trim ends, collapse inner whitespace, uppercase. */
export function normalizePlate(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase()
}
