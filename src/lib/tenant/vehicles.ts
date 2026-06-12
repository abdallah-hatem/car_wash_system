import { supabase } from "@/lib/supabase"
import { canonicalPlate, normalizePlateSearch } from "./plate"

export interface Vehicle {
  id: string
  customer_id: string | null
  plate_number: string
  plate_letters: string | null
  plate_digits: string | null
  make: string | null
  model: string | null
  color: string | null
  created_at: string
}

export interface PlateMatch extends Vehicle {
  customer_name: string | null
}

export async function listVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
  const { data, error } = await supabase
    .from("vehicles")
    .select("id,customer_id,plate_number,plate_letters,plate_digits,make,model,color,created_at")
    .eq("customer_id", customerId)
    .order("created_at")
  if (error) throw error
  return data as Vehicle[]
}

export async function createVehicle(
  tenantId: string,
  input: {
    customer_id: string | null
    plate_letters: string
    plate_digits: string
    make?: string | null
    model?: string | null
    color?: string | null
  },
): Promise<string> {
  const plate_number = canonicalPlate(input.plate_letters, input.plate_digits)
  const { data, error } = await supabase.from("vehicles").insert({
    tenant_id: tenantId,
    customer_id: input.customer_id,
    plate_letters: input.plate_letters,
    plate_digits: input.plate_digits,
    plate_number,
    make: input.make?.trim() || null,
    model: input.model?.trim() || null,
    color: input.color?.trim() || null,
  }).select("id").single()
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new Error("duplicate")
    throw error
  }
  return data.id
}

export async function updateVehicle(
  id: string,
  input: {
    plate_letters: string
    plate_digits: string
    make?: string | null
    model?: string | null
    color?: string | null
  },
): Promise<void> {
  const plate_number = canonicalPlate(input.plate_letters, input.plate_digits)
  const { error } = await supabase
    .from("vehicles")
    .update({
      plate_letters: input.plate_letters,
      plate_digits: input.plate_digits,
      plate_number,
      make: input.make?.trim() || null,
      model: input.model?.trim() || null,
      color: input.color?.trim() || null,
    })
    .eq("id", id)
  if (error) {
    if ((error as { code?: string }).code === "23505") throw new Error("duplicate")
    throw error
  }
}

export async function removeVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id)
  if (error) throw error
}

export async function searchVehiclesByPlate(term: string): Promise<PlateMatch[]> {
  const norm = normalizePlateSearch(term)
  if (!norm) return []
  // Escape LIKE wildcards so a literal % or _ doesn't act as a pattern.
  const esc = norm.replace(/[\\%_]/g, "\\$&")
  const { data, error } = await supabase
    .from("vehicles")
    .select("id,customer_id,plate_number,plate_letters,plate_digits,make,model,color,created_at,customers(name)")
    .ilike("plate_number", `%${esc}%`)
    .limit(20)
  if (error) throw error
  return ((data ?? []) as unknown as Array<{
    id: string
    customer_id: string | null
    plate_number: string
    plate_letters: string | null
    plate_digits: string | null
    make: string | null
    model: string | null
    color: string | null
    created_at: string
    customers: { name: string } | null
  }>).map((v) => ({
    id: v.id,
    customer_id: v.customer_id,
    plate_number: v.plate_number,
    plate_letters: v.plate_letters,
    plate_digits: v.plate_digits,
    make: v.make,
    model: v.model,
    color: v.color,
    created_at: v.created_at,
    customer_name: v.customers?.name ?? null,
  }))
}
