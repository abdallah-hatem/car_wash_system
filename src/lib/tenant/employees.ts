import { supabase } from "@/lib/supabase"

export interface Employee { id: string; name: string; phone: string | null; branch_id: string | null; is_active: boolean; created_at: string }

export async function listEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from("employees").select("id,name,phone,branch_id,is_active,created_at").order("created_at")
  if (error) throw error
  return data as Employee[]
}
export async function createEmployee(tenantId: string, input: { name: string; phone?: string | null; branch_id: string | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("employees").insert({ tenant_id: tenantId, name: input.name.trim(), phone: input.phone?.trim() || null, branch_id: input.branch_id, is_active: input.is_active })
  if (error) throw error
}
export async function updateEmployee(id: string, input: { name: string; phone?: string | null; branch_id: string | null; is_active: boolean }): Promise<void> {
  const { error } = await supabase.from("employees").update({ name: input.name.trim(), phone: input.phone?.trim() || null, branch_id: input.branch_id, is_active: input.is_active }).eq("id", id)
  if (error) throw error
}
export async function setEmployeeActive(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase.from("employees").update({ is_active }).eq("id", id)
  if (error) throw error
}
export async function removeEmployee(id: string): Promise<void> {
  const { error } = await supabase.from("employees").delete().eq("id", id)
  if (error) throw error
}
