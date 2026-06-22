import { supabase } from "@/lib/supabase"
import { pageToRange, PAGE_SIZE } from "@/lib/pagination"
import { dedupeIds } from "./customer-search"
import { normalizePlateSearch } from "./plate"

export interface Customer {
  id: string
  name: string
  phone: string | null
  branch_id: string | null
  created_at: string
  vehicle_count: number
}

// Columns selected for a Customer (+ vehicle count via the FK relationship).
const CUSTOMER_SELECT = "id,name,phone,branch_id,created_at,vehicles(count)"

interface RawCustomer {
  id: string
  name: string
  phone: string | null
  branch_id: string | null
  created_at: string
  vehicles: Array<{ count: number }>
}

function mapCustomer(c: RawCustomer): Customer {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    branch_id: c.branch_id,
    created_at: c.created_at,
    vehicle_count: c.vehicles?.[0]?.count ?? 0,
  }
}

/** Escape LIKE special characters: \, %, _ */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, "\\$&")
}

/**
 * Returns up to 500 deduplicated customer ids matching the search term
 * by name, phone, or plate number. Returns [] for blank term.
 */
export async function matchingCustomerIds(term: string): Promise<string[]> {
  const trimmed = term.trim()
  if (!trimmed) return []

  const esc = escapeLike(trimmed)

  // name match
  const namePromise = supabase
    .from("customers")
    .select("id")
    .ilike("name", `%${esc}%`)
    .limit(500)

  // phone match
  const phonePromise = supabase
    .from("customers")
    .select("id")
    .ilike("phone", `%${esc}%`)
    .limit(500)

  // plate match — normalize Arabic-Indic digits
  const normalizedPlate = normalizePlateSearch(trimmed)
  const escPlate = escapeLike(normalizedPlate)
  const platePromise = supabase
    .from("vehicles")
    .select("customer_id")
    .ilike("plate_number", `%${escPlate}%`)
    .not("customer_id", "is", null)
    .limit(500)

  const [nameResult, phoneResult, plateResult] = await Promise.all([namePromise, phonePromise, platePromise])

  if (nameResult.error) throw nameResult.error
  if (phoneResult.error) throw phoneResult.error
  if (plateResult.error) throw plateResult.error

  const nameIds = ((nameResult.data ?? []) as { id: string }[]).map((r) => r.id)
  const phoneIds = ((phoneResult.data ?? []) as { id: string }[]).map((r) => r.id)
  const plateIds = ((plateResult.data ?? []) as { customer_id: string }[])
    .map((r) => r.customer_id)
    .filter(Boolean)

  return dedupeIds(nameIds, phoneIds, plateIds).slice(0, 500)
}

export async function listCustomersPaged(
  page: number,
  pageSize = PAGE_SIZE,
  search = "",
): Promise<{ rows: Customer[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)

  if (!search.trim()) {
    // No search — full paginated list
    const { data, error, count } = await supabase
      .from("customers")
      .select(CUSTOMER_SELECT, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to)
    if (error) throw error
    return { rows: ((data ?? []) as unknown as RawCustomer[]).map(mapCustomer), total: count ?? 0 }
  }

  // Search — filter by matching ids
  const ids = await matchingCustomerIds(search)
  if (ids.length === 0) return { rows: [], total: 0 }

  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .in("id", ids)
    .order("created_at", { ascending: false })
    .range(from, to)
  if (error) throw error
  return { rows: ((data ?? []) as unknown as RawCustomer[]).map(mapCustomer), total: ids.length }
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapCustomer(data as unknown as RawCustomer)
}

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select(CUSTOMER_SELECT)
    .order("created_at", { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as RawCustomer[]).map(mapCustomer)
}

export async function createCustomer(
  tenantId: string,
  input: { name: string; phone?: string | null; branch_id?: string | null },
): Promise<string> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      branch_id: input.branch_id ?? null,
    })
    .select("id")
    .single()
  if (error) throw error
  return data.id
}

export async function updateCustomer(
  id: string,
  input: { name: string; phone?: string | null },
): Promise<void> {
  const { error } = await supabase
    .from("customers")
    .update({ name: input.name.trim(), phone: input.phone?.trim() || null })
    .eq("id", id)
  if (error) throw error
}

export async function removeCustomer(id: string): Promise<void> {
  const { error } = await supabase.from("customers").delete().eq("id", id)
  if (error) throw error
}
