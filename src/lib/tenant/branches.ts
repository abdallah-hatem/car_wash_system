import { supabase } from "@/lib/supabase"
import { pageToRange, PAGE_SIZE } from "@/lib/pagination"

export interface Branch { id: string; name: string; address: string | null; created_at: string }

export async function listBranchesPaged(page: number, pageSize = PAGE_SIZE): Promise<{ rows: Branch[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)
  const { data, error, count } = await supabase
    .from("branches").select("id,name,address,created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range(from, to)
  if (error) throw error
  return { rows: (data ?? []) as Branch[], total: count ?? 0 }
}

export async function listBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from("branches").select("id,name,address,created_at").order("created_at")
  if (error) throw error
  return data as Branch[]
}
export async function createBranch(tenantId: string, input: { name: string; address?: string | null }): Promise<void> {
  const { error } = await supabase.from("branches").insert({ tenant_id: tenantId, name: input.name.trim(), address: input.address?.trim() || null })
  if (error) throw error
}
export async function updateBranch(id: string, input: { name: string; address?: string | null }): Promise<void> {
  const { error } = await supabase.from("branches").update({ name: input.name.trim(), address: input.address?.trim() || null }).eq("id", id)
  if (error) throw error
}
export async function removeBranch(id: string): Promise<void> {
  const { error } = await supabase.from("branches").delete().eq("id", id)
  if (error) {
    if ((error as { code?: string }).code === "23503") throw new Error("in_use")
    throw error
  }
}
