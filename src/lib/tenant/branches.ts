import { supabase } from "@/lib/supabase"

export interface Branch { id: string; name: string; address: string | null; created_at: string }

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
