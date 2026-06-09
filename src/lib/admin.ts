import { supabase } from "./supabase"

export interface Business {
  id: string
  name: string
  status: "active" | "suspended"
  created_at: string
}

export async function listBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("id,name,status,created_at")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data as Business[]
}

export async function setBusinessStatus(
  id: string,
  status: "active" | "suspended",
): Promise<void> {
  const { error } = await supabase.from("tenants").update({ status }).eq("id", id)
  if (error) throw error
}

export interface CreateBusinessInput {
  businessName: string
  ownerEmail: string
  ownerFullName: string
}

export interface CreateBusinessResult {
  tenantId: string
  businessName: string
  ownerEmail: string
  tempPassword: string
}

export async function createBusiness(
  input: CreateBusinessInput,
): Promise<CreateBusinessResult> {
  const { data, error } = await supabase.functions.invoke("create-business", {
    body: input,
  })
  if (error) {
    let code = "generic"
    try {
      const ctx = (error as { context?: Response }).context
      const body = await ctx?.json?.()
      if (body?.error) code = body.error
    } catch {
      /* ignore */
    }
    throw new Error(code)
  }
  return data as CreateBusinessResult
}

export function validateCreate(input: Partial<CreateBusinessInput>): string | null {
  if (!input.businessName?.trim()) return "missing_fields"
  if (
    !input.ownerEmail?.trim() ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.ownerEmail)
  )
    return "missing_fields"
  return null
}
