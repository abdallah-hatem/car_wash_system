// Core logic for the manage-users edge function (owner-only sub-user CRUD).
// Extracted from index.ts so it can be unit-tested with a mocked admin client.
// All handlers are scoped to the CALLER'S tenant id (resolved authoritatively in
// index.ts) and may only target `manager` rows in that tenant — never another
// owner, never another tenant.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export const TABS = [
  "dashboard", "analytics", "queue", "washes", "customers", "packages", "staff",
] as const;
export type TabKey = (typeof TABS)[number];
export type PermLevel = "none" | "view" | "edit";
const LEVELS: PermLevel[] = ["none", "view", "edit"];

export type Action = "create" | "update" | "setActive" | "delete" | "resetPassword";

export class ManageError extends Error {
  code: "invalid" | "email_exists" | "not_found" | "internal";
  constructor(code: ManageError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "ManageError";
  }
}

export interface CreateInput {
  action: "create";
  email: string;
  password: string;
  fullName: string;
  branchIds: string[];
  permissions: Partial<Record<TabKey, PermLevel>>;
}
export interface UpdateInput {
  action: "update";
  userId: string;
  fullName?: string;
  branchIds?: string[];
  permissions?: Partial<Record<TabKey, PermLevel>>;
}
export interface SetActiveInput { action: "setActive"; userId: string; isActive: boolean }
export interface DeleteInput { action: "delete"; userId: string }
export interface ResetPasswordInput { action: "resetPassword"; userId: string; password: string }
export interface ListInput { action: "list" }
export type ValidInput =
  | CreateInput | UpdateInput | SetActiveInput | DeleteInput | ResetPasswordInput | ListInput;
export interface ValidationError { error: "invalid" }

export interface UserSummary {
  userId: string;
  email: string;
  fullName: string | null;
  branchIds: string[];
  permissions: Partial<Record<TabKey, PermLevel>>;
  isActive: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export function sanitizePermissions(v: unknown): Partial<Record<TabKey, PermLevel>> {
  const out: Partial<Record<TabKey, PermLevel>> = {};
  if (v && typeof v === "object") {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if ((TABS as readonly string[]).includes(k) && LEVELS.includes(val as PermLevel)) {
        out[k as TabKey] = val as PermLevel;
      }
    }
  }
  return out;
}

function sanitizeBranchIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  // de-dupe + keep only non-empty strings
  return [...new Set(v.filter((x): x is string => typeof x === "string" && x.length > 0))];
}

export function validateInput(body: unknown): ValidInput | ValidationError {
  if (typeof body !== "object" || body === null) return { error: "invalid" };
  const b = body as Record<string, unknown>;
  const action = b.action;

  if (action === "create") {
    const email = typeof b.email === "string" ? b.email.trim() : "";
    const password = typeof b.password === "string" ? b.password : "";
    const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
    if (!EMAIL_RE.test(email)) return { error: "invalid" };
    if (password.length < MIN_PASSWORD) return { error: "invalid" };
    return {
      action, email, password, fullName,
      branchIds: sanitizeBranchIds(b.branchIds),
      permissions: sanitizePermissions(b.permissions),
    };
  }
  if (action === "update") {
    const userId = typeof b.userId === "string" ? b.userId : "";
    if (!userId) return { error: "invalid" };
    const out: UpdateInput = { action, userId };
    if (typeof b.fullName === "string") out.fullName = b.fullName.trim();
    if (b.branchIds !== undefined) out.branchIds = sanitizeBranchIds(b.branchIds);
    if (b.permissions !== undefined) out.permissions = sanitizePermissions(b.permissions);
    return out;
  }
  if (action === "setActive") {
    const userId = typeof b.userId === "string" ? b.userId : "";
    if (!userId || typeof b.isActive !== "boolean") return { error: "invalid" };
    return { action, userId, isActive: b.isActive };
  }
  if (action === "delete") {
    const userId = typeof b.userId === "string" ? b.userId : "";
    if (!userId) return { error: "invalid" };
    return { action, userId };
  }
  if (action === "list") {
    return { action };
  }
  if (action === "resetPassword") {
    const userId = typeof b.userId === "string" ? b.userId : "";
    const password = typeof b.password === "string" ? b.password : "";
    if (!userId || password.length < MIN_PASSWORD) return { error: "invalid" };
    return { action, userId, password };
  }
  return { error: "invalid" };
}

// deno-lint-ignore no-explicit-any
type Admin = SupabaseClient<any, any, any>;

// Guard: the target must be a `manager` profile in the caller's tenant.
// Prevents an owner editing another owner, themselves, or a user in another tenant.
async function assertTargetManager(admin: Admin, tenantId: string, userId: string): Promise<void> {
  const { data, error } = await admin
    .from("profiles").select("tenant_id, role").eq("user_id", userId).maybeSingle();
  if (error) throw new ManageError("internal", error.message);
  if (!data || data.tenant_id !== tenantId || data.role !== "manager") {
    throw new ManageError("not_found", "target is not a manager in your business");
  }
}

// Verify every branch id belongs to the caller's tenant (no cross-tenant assignment).
async function assertBranchesInTenant(admin: Admin, tenantId: string, branchIds: string[]): Promise<void> {
  if (branchIds.length === 0) return;
  const { data, error } = await admin
    .from("branches").select("id").eq("tenant_id", tenantId).in("id", branchIds);
  if (error) throw new ManageError("internal", error.message);
  if (!data || data.length !== branchIds.length) {
    throw new ManageError("invalid", "one or more branches are not in your business");
  }
}

async function replaceBranches(admin: Admin, tenantId: string, userId: string, branchIds: string[]): Promise<void> {
  const { error: delErr } = await admin.from("user_branches").delete().eq("user_id", userId);
  if (delErr) throw new ManageError("internal", delErr.message);
  if (branchIds.length === 0) return;
  const rows = branchIds.map((branch_id) => ({ tenant_id: tenantId, user_id: userId, branch_id }));
  const { error: insErr } = await admin.from("user_branches").insert(rows);
  if (insErr) throw new ManageError("internal", insErr.message);
}

export async function createUser(admin: Admin, tenantId: string, input: CreateInput): Promise<{ userId: string }> {
  await assertBranchesInTenant(admin, tenantId, input.branchIds);

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      throw new ManageError("email_exists", "email already registered");
    }
    throw new ManageError("internal", `failed to create user: ${createErr?.message ?? "unknown"}`);
  }
  const userId = created.user.id;

  try {
    const { error: profErr } = await admin.from("profiles").insert({
      user_id: userId,
      tenant_id: tenantId,
      role: "manager",
      full_name: input.fullName || null,
      permissions: input.permissions,
      is_active: true,
    });
    if (profErr) throw new ManageError("internal", profErr.message);
    await replaceBranches(admin, tenantId, userId, input.branchIds);
    return { userId };
  } catch (err) {
    // Roll back the orphan auth user on any post-create failure.
    try { await admin.auth.admin.deleteUser(userId); } catch (_) { /* best effort */ }
    throw err instanceof ManageError ? err : new ManageError("internal", "create failed");
  }
}

export async function updateUser(admin: Admin, tenantId: string, input: UpdateInput): Promise<void> {
  await assertTargetManager(admin, tenantId, input.userId);
  if (input.branchIds !== undefined) await assertBranchesInTenant(admin, tenantId, input.branchIds);

  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName || null;
  if (input.permissions !== undefined) patch.permissions = input.permissions;
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from("profiles").update(patch).eq("user_id", input.userId);
    if (error) throw new ManageError("internal", error.message);
  }
  if (input.branchIds !== undefined) await replaceBranches(admin, tenantId, input.userId, input.branchIds);
}

export async function setActive(admin: Admin, tenantId: string, input: SetActiveInput): Promise<void> {
  await assertTargetManager(admin, tenantId, input.userId);
  const { error } = await admin.from("profiles").update({ is_active: input.isActive }).eq("user_id", input.userId);
  if (error) throw new ManageError("internal", error.message);
}

export async function deleteUser(admin: Admin, tenantId: string, input: DeleteInput): Promise<void> {
  await assertTargetManager(admin, tenantId, input.userId);
  // profiles + user_branches cascade on auth.users delete.
  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) throw new ManageError("internal", error.message);
}

export async function resetPassword(admin: Admin, tenantId: string, input: ResetPasswordInput): Promise<void> {
  await assertTargetManager(admin, tenantId, input.userId);
  const { error } = await admin.auth.admin.updateUserById(input.userId, { password: input.password });
  if (error) throw new ManageError("internal", error.message);
}

// List the caller tenant's sub-users (managers) with email + branches + permissions.
// Email lives in auth.users (only the service_role can read it), so this runs here
// rather than as a direct client query.
export async function listUsers(admin: Admin, tenantId: string): Promise<UserSummary[]> {
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("user_id, full_name, permissions, is_active")
    .eq("tenant_id", tenantId).eq("role", "manager");
  if (profErr) throw new ManageError("internal", profErr.message);
  const rows = profiles ?? [];
  if (rows.length === 0) return [];

  const { data: ub, error: ubErr } = await admin
    .from("user_branches").select("user_id, branch_id").eq("tenant_id", tenantId);
  if (ubErr) throw new ManageError("internal", ubErr.message);
  const byUser = new Map<string, string[]>();
  for (const r of ub ?? []) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r.branch_id);
    byUser.set(r.user_id, list);
  }

  return await Promise.all(rows.map(async (p) => {
    const { data: u } = await admin.auth.admin.getUserById(p.user_id);
    return {
      userId: p.user_id,
      email: u?.user?.email ?? "",
      fullName: p.full_name ?? null,
      branchIds: byUser.get(p.user_id) ?? [],
      permissions: sanitizePermissions(p.permissions),
      isActive: p.is_active !== false,
    };
  }));
}
