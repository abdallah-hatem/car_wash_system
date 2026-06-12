import { supabase } from "@/lib/supabase"
import { normalizePlate } from "./plate"

export interface Vehicle {
  id: string
  customer_id: string | null
  plate_number: string
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
    .select("id,customer_id,plate_number,make,model,color,created_at")
    .eq("customer_id", customerId)
    .order("created_at")
  if (error) throw error
  return data as Vehicle[]
}

export async function createVehicle(
  tenantId: string,
  input: {
    customer_id: string | null
    plate_number: string
    make?: string | null
    model?: string | null
    color?: string | null
  },
): Promise<void> {
  const { error } = await supabase.from("vehicles").insert({
    tenant_id: tenantId,
    customer_id: input.customer_id,
    plate_number: input.plate_number.trim(),
    make: input.make?.trim() || null,
    model: input.model?.trim() || null,
    color: input.color?.trim() || null,
  })
  if (error) throw error
}

export async function updateVehicle(
  id: string,
  input: {
    plate_number: string
    make?: string | null
    model?: string | null
    color?: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from("vehicles")
    .update({
      plate_number: input.plate_number.trim(),
      make: input.make?.trim() || null,
      model: input.model?.trim() || null,
      color: input.color?.trim() || null,
    })
    .eq("id", id)
  if (error) throw error
}

export async function removeVehicle(id: string): Promise<void> {
  const { error } = await supabase.from("vehicles").delete().eq("id", id)
  if (error) throw error
}

export async function searchVehiclesByPlate(term: string): Promise<PlateMatch[]> {
  const norm = normalizePlate(term)
  if (!norm) return []
  const { data, error } = await supabase
    .from("vehicles")
    .select("id,customer_id,plate_number,make,model,color,created_at,customers(name)")
    .ilike("plate_number", `%${norm}%`)
    .limit(20)
  if (error) throw error
  return ((data ?? []) as unknown as Array<{
    id: string
    customer_id: string | null
    plate_number: string
    make: string | null
    model: string | null
    color: string | null
    created_at: string
    customers: { name: string } | null
  }>).map((v) => ({
    id: v.id,
    customer_id: v.customer_id,
    plate_number: v.plate_number,
    make: v.make,
    model: v.model,
    color: v.color,
    created_at: v.created_at,
    customer_name: v.customers?.name ?? null,
  }))
}
