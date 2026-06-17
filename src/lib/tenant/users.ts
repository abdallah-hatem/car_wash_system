import { supabase } from "@/lib/supabase"
import type { TabKey, PermLevel } from "@/auth/claims"

export interface ManagedUser {
  userId: string
  email: string
  fullName: string | null
  branchIds: string[]
  permissions: Partial<Record<TabKey, PermLevel>>
  isActive: boolean
}

export interface CreateUserInput {
  email: string
  password: string
  fullName: string
  branchIds: string[]
  permissions: Partial<Record<TabKey, PermLevel>>
}

export interface UpdateUserInput {
  userId: string
  fullName?: string
  branchIds?: string[]
  permissions?: Partial<Record<TabKey, PermLevel>>
}

// Invoke the owner-only manage-users edge function. On error, surface the
// function's `{ error: code }` body as the thrown message (UI maps to i18n).
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("manage-users", { body })
  if (error) {
    let code = "generic"
    try {
      const ctx = (error as { context?: Response }).context
      const b = await ctx?.json?.()
      if (b?.error) code = b.error as string
    } catch {
      /* ignore */
    }
    throw new Error(code)
  }
  return data as T
}

export async function listUsers(): Promise<ManagedUser[]> {
  const data = await invoke<{ users: ManagedUser[] }>({ action: "list" })
  return data.users ?? []
}

export async function createUser(input: CreateUserInput): Promise<void> {
  await invoke({ action: "create", ...input })
}

export async function updateUser(input: UpdateUserInput): Promise<void> {
  await invoke({ action: "update", ...input })
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  await invoke({ action: "setActive", userId, isActive })
}

export async function deleteUser(userId: string): Promise<void> {
  await invoke({ action: "delete", userId })
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  await invoke({ action: "resetPassword", userId, password })
}
