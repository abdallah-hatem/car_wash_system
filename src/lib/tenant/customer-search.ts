import { supabase } from "@/lib/supabase"
import { normalizePlateSearch } from "./plate"

export interface CustomerMatch {
  id: string
  name: string
  phone: string | null
  matched_plate: string | null
}

/**
 * Pure merge helper — combines name/phone hits with plate hits, dedupes by customer id.
 * Name/phone hits appear first; plate-only hits appended afterwards.
 * Customers with a null owner in the vehicles table are skipped.
 */
export function mergeCustomerResults(
  byNameOrPhone: { id: string; name: string; phone: string | null }[],
  byPlate: { plate_number: string; customer: { id: string; name: string; phone: string | null } | null }[],
): CustomerMatch[] {
  // Build ordered map — name/phone hits first (matched_plate null initially)
  const map = new Map<string, CustomerMatch>()
  for (const c of byNameOrPhone) {
    map.set(c.id, { id: c.id, name: c.name, phone: c.phone, matched_plate: null })
  }

  // Process plate hits
  for (const v of byPlate) {
    if (!v.customer) continue // skip vehicles with no linked customer
    const existing = map.get(v.customer.id)
    if (existing) {
      // Fill matched_plate if not already set (name/phone hit already placed it in map)
      if (existing.matched_plate === null) {
        existing.matched_plate = v.plate_number
      }
    } else {
      // New entry — plate-only hit
      map.set(v.customer.id, {
        id: v.customer.id,
        name: v.customer.name,
        phone: v.customer.phone,
        matched_plate: v.plate_number,
      })
    }
  }

  return Array.from(map.values())
}

/** Escape LIKE special characters: \, %, _ */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&")
}

/**
 * Search customers by name OR phone OR plate number.
 * Runs two separate queries (name ilike + phone ilike merged, then plate ilike)
 * and merges the results via mergeCustomerResults.
 */
export async function searchCustomers(term: string): Promise<CustomerMatch[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const esc = escapeLike(trimmed)

  // Query 1a: match by name
  const namePromise = supabase
    .from("customers")
    .select("id,name,phone")
    .ilike("name", `%${esc}%`)
    .limit(20)

  // Query 1b: match by phone
  const phonePromise = supabase
    .from("customers")
    .select("id,name,phone")
    .ilike("phone", `%${esc}%`)
    .limit(20)

  // Query 2: match plate_number (normalize Arabic-Indic digits)
  const normalizedPlate = normalizePlateSearch(trimmed)
  const escPlate = escapeLike(normalizedPlate)
  const platePromise = supabase
    .from("vehicles")
    .select("plate_number,customers(id,name,phone)")
    .ilike("plate_number", `%${escPlate}%`)
    .limit(20)

  const [nameResult, phoneResult, plateResult] = await Promise.all([namePromise, phonePromise, platePromise])

  if (nameResult.error) throw nameResult.error
  if (phoneResult.error) throw phoneResult.error
  if (plateResult.error) throw plateResult.error

  // Merge name + phone results, deduping by id
  const nameRows = (nameResult.data ?? []) as { id: string; name: string; phone: string | null }[]
  const phoneRows = (phoneResult.data ?? []) as { id: string; name: string; phone: string | null }[]

  const seenIds = new Set<string>()
  const byNameOrPhone: { id: string; name: string; phone: string | null }[] = []
  for (const row of [...nameRows, ...phoneRows]) {
    if (!seenIds.has(row.id)) {
      seenIds.add(row.id)
      byNameOrPhone.push(row)
    }
  }

  // Map plate results: PostgREST returns customers as an object (single FK), not array
  const byPlate = ((plateResult.data ?? []) as unknown as Array<{
    plate_number: string
    customers: { id: string; name: string; phone: string | null } | null
  }>).map((v) => ({
    plate_number: v.plate_number,
    customer: v.customers,
  }))

  const merged = mergeCustomerResults(byNameOrPhone, byPlate)

  // Cap at 20 total
  return merged.slice(0, 20)
}
