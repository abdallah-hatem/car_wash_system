import { supabase } from "@/lib/supabase"
import { pageToRange, PAGE_SIZE } from "@/lib/pagination"

export interface Customer {
  id: string
  name: string
  phone: string | null
  created_at: string
  vehicle_count: number
}

export async function listCustomersPaged(page: number, pageSize = PAGE_SIZE): Promise<{ rows: Customer[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)
  const { data, error, count } = await supabase
    .from("customers")
    .select("id,name,phone,created_at,vehicles(count)", { count: "exact" })
    .order("created_at", { ascending: false }).range(from, to)
  if (error) throw error
  const rows = ((data ?? []) as unknown as Array<{
    id: string
    name: string
    phone: string | null
    created_at: string
    vehicles: Array<{ count: number }>
  }>).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    created_at: c.created_at,
    vehicle_count: c.vehicles?.[0]?.count ?? 0,
  }))
  return { rows, total: count ?? 0 }
}

export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id,name,phone,created_at,vehicles(count)")
    .order("created_at", { ascending: false })
  if (error) throw error
  return ((data ?? []) as unknown as Array<{
    id: string
    name: string
    phone: string | null
    created_at: string
    vehicles: Array<{ count: number }>
  }>).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    created_at: c.created_at,
    vehicle_count: c.vehicles?.[0]?.count ?? 0,
  }))
}

export async function createCustomer(
  tenantId: string,
  input: { name: string; phone?: string | null },
): Promise<string> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      tenant_id: tenantId,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
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
