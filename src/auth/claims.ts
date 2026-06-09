export type TenantRole = "owner" | "manager"

export interface AppClaims {
  tenantId: string | null
  role: TenantRole | null
  isPlatformAdmin: boolean
}

export function parseClaims(payload: Record<string, unknown>): AppClaims {
  return {
    tenantId: (payload.tenant_id as string) ?? null,
    role: (payload.role as TenantRole) ?? null,
    isPlatformAdmin: payload.is_platform_admin === true,
  }
}
