import { supabase } from "./supabase"
import { pageToRange, PAGE_SIZE } from "./pagination"

export interface Business {
  id: string
  name: string
  status: "active" | "suspended"
  created_at: string
}

export async function listBusinessesPaged(page: number, pageSize = PAGE_SIZE): Promise<{ rows: Business[]; total: number }> {
  const { from, to } = pageToRange(page, pageSize)
  const { data, error, count } = await supabase
    .from("tenants")
    .select("id,name,status,created_at", { count: "exact" })
    .order("created_at", { ascending: false }).range(from, to)
  if (error) throw error
  return { rows: (data as Business[]) ?? [], total: count ?? 0 }
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
  locale?: string
}

export interface CreateBusinessResult {
  tenantId: string
  businessName: string
  ownerEmail: string
  // The owner is emailed a set-password (invite) link; it's also returned so the
  // admin can copy/hand it over. `emailed` reflects whether the email went out.
  actionLink: string | null
  emailed: boolean
}

export async function createBusiness(
  input: CreateBusinessInput,
): Promise<CreateBusinessResult> {
  const { data, error } = await supabase.functions.invoke("create-business", {
    body: { ...input, appUrl: window.location.origin },
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
