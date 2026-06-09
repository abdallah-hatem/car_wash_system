export type TenantRole = "owner" | "manager"

export interface AppClaims {
  tenantId: string | null
  role: TenantRole | null
  isPlatformAdmin: boolean
}

export const EMPTY_CLAIMS: AppClaims = { tenantId: null, role: null, isPlatformAdmin: false }

export function parseClaims(payload: Record<string, unknown>): AppClaims {
  return {
    tenantId: (payload.tenant_id as string) ?? null,
    role: (payload.role as TenantRole) ?? null,
    isPlatformAdmin: payload.is_platform_admin === true,
  }
}

export function decodeClaims(session: { access_token: string } | null): AppClaims {
  if (!session) return EMPTY_CLAIMS
  try {
    const payload = JSON.parse(atob(session.access_token.split(".")[1]))
    return parseClaims(payload)
  } catch {
    return EMPTY_CLAIMS
  }
}
