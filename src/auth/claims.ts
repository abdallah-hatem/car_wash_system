export type TenantRole = "owner" | "manager"

/** Per-tab access level. `none` < `view` < `edit`. */
export type PermLevel = "none" | "view" | "edit"

/** Tabs whose access is permission-gated (branches + users management are owner-only). */
export type TabKey =
  | "dashboard"
  | "analytics"
  | "queue"
  | "washes"
  | "customers"
  | "packages"
  | "staff"

export interface AppClaims {
  tenantId: string | null
  role: TenantRole | null
  isPlatformAdmin: boolean
  /** Branches the user is responsible for. Empty for an owner (means "all"). */
  branchIds: string[]
  /** Per-tab permission map. A missing tab means `none`. Owners ignore it (full access). */
  permissions: Partial<Record<TabKey, PermLevel>>
}

export const EMPTY_CLAIMS: AppClaims = {
  tenantId: null,
  role: null,
  isPlatformAdmin: false,
  branchIds: [],
  permissions: {},
}

function parseBranchIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []
}

function parsePermissions(value: unknown): Partial<Record<TabKey, PermLevel>> {
  const out: Partial<Record<TabKey, PermLevel>> = {}
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === "none" || v === "view" || v === "edit") out[k as TabKey] = v
    }
  }
  return out
}

export function parseClaims(payload: Record<string, unknown>): AppClaims {
  return {
    tenantId: (payload.tenant_id as string) ?? null,
    role: (payload.app_role as TenantRole) ?? null,
    isPlatformAdmin: payload.is_platform_admin === true,
    branchIds: parseBranchIds(payload.branch_ids),
    permissions: parsePermissions(payload.permissions),
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

// ── Permission helpers ────────────────────────────────────────────────────────
// Owners always pass. Members are gated by their permission map / branch list.

export function isOwner(claims: AppClaims): boolean {
  return claims.role === "owner"
}

/** Can the user see (read) this tab? Owner ⇒ always; else level is `view` or `edit`. */
export function canView(claims: AppClaims, tab: TabKey): boolean {
  if (isOwner(claims)) return true
  const lvl = claims.permissions[tab]
  return lvl === "view" || lvl === "edit"
}

/** Can the user edit/act in this tab? Owner ⇒ always; else level is `edit`. */
export function canEdit(claims: AppClaims, tab: TabKey): boolean {
  if (isOwner(claims)) return true
  return claims.permissions[tab] === "edit"
}

/** The branches a user may operate on: all for an owner, else those assigned to them. */
export function visibleBranches<T extends { id: string }>(claims: AppClaims, branches: T[]): T[] {
  if (isOwner(claims)) return branches
  const allowed = new Set(claims.branchIds)
  return branches.filter((b) => allowed.has(b.id))
}
