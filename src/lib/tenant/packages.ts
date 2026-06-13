import { supabase } from "@/lib/supabase"
import { pageToRange, PAGE_SIZE } from "@/lib/pagination"

export interface Package { id: string; name: string; price: number; duration_minutes: number | null; is_active: boolean; created_at: string }

export async function listPackagesPaged(page: number, pageSize = PAGE_SIZE): Promise<{ rows: Package[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)
  const { data, error, count } = await supabase
    .from("packages").select("id,name,price,duration_minutes,is_active,created_at", { count: "exact" })
    .order("created_at").range(from, to)
  if (error) throw error
  return { rows: (data as unknown as Package[]) ?? [], total: count ?? 0 }
}

export async function listPackages(): Promise<Package[]> {
  const { data, error } = await supabase.from("packages").select("id,name,price,duration_minutes,is_active,created_at").order("created_at")
  if (error) throw error
  return (data as unknown as Package[])
}
export async function createPackage(tenantId: string, input: { name: string; price: number; duration_minutes: number | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("packages").insert({ tenant_id: tenantId, name: input.name.trim(), price: input.price, duration_minutes: input.duration_minutes, is_active: input.is_active })
  if (error) throw error
}
export async function updatePackage(id: string, input: { name: string; price: number; duration_minutes: number | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("packages").update({ name: input.name.trim(), price: input.price, duration_minutes: input.duration_minutes, is_active: input.is_active }).eq("id", id)
  if (error) throw error
}
export async function setPackageActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from("packages").update({ is_active }).eq("id", id)
  if (error) throw error
}
export async function removePackage(id: string): Promise<void> {
  const { error } = await supabase.from("packages").delete().eq("id", id)
  if (error) throw error
}
