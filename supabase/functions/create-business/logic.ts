// Core, side-effect-light logic for the create-business edge function.
// Extracted from index.ts so it can be unit tested without starting an HTTP
// listener. provisionBusiness takes an injected supabase admin client so it
// can be mocked in tests.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface ValidInput {
  businessName: string;
  ownerEmail: string;
  ownerFullName: string;
}

export interface ValidationError {
  error: "missing_fields";
}

export interface ProvisionResult {
  tenantId: string;
  businessName: string;
  ownerEmail: string;
  tempPassword: string;
}

// A thrown ProvisionError carries an error code that index.ts maps to a status.
export class ProvisionError extends Error {
  code: "email_exists" | "internal";
  constructor(code: "email_exists" | "internal", message: string) {
    super(message);
    this.code = code;
    this.name = "ProvisionError";
  }
}

// Generate a random temporary password: >=12 chars, guaranteed to contain at
// least one uppercase, one lowercase, and one digit.
export function tempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const all = upper + lower + digit + "!@#$%^&*";

  const pick = (set: string) => set[randInt(set.length)];

  // Guarantee one of each required class, then fill to length 16.
  const chars = [pick(upper), pick(lower), pick(digit)];
  while (chars.length < 16) {
    chars.push(all[randInt(all.length)]);
  }

  // Fisher-Yates shuffle so required chars are not always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

function randInt(max: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

// Basic, intentionally-loose email shape check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInput(
  body: unknown,
): ValidInput | ValidationError {
  if (typeof body !== "object" || body === null) {
    return { error: "missing_fields" };
  }
  const b = body as Record<string, unknown>;

  const businessName =
    typeof b.businessName === "string" ? b.businessName.trim() : "";
  const ownerEmail =
    typeof b.ownerEmail === "string" ? b.ownerEmail.trim() : "";
  const ownerFullName =
    typeof b.ownerFullName === "string" ? b.ownerFullName.trim() : "";

  if (!businessName) return { error: "missing_fields" };
  if (!ownerEmail || !EMAIL_RE.test(ownerEmail)) {
    return { error: "missing_fields" };
  }

  return { businessName, ownerEmail, ownerFullName };
}

// Steps 2-5: create auth user, tenant, owner profile, default branch.
// On any DB failure after the auth user is created, the auth user is deleted
// so we never leave an orphan.
export async function provisionBusiness(
  // deno-lint-ignore no-explicit-any
  admin: SupabaseClient<any, any, any>,
  input: ValidInput,
): Promise<ProvisionResult> {
  const password = tempPassword();

  // Step 2: create the auth user.
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: input.ownerEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: input.ownerFullName },
    });

  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? "").toLowerCase();
    if (
      msg.includes("already") ||
      msg.includes("registered") ||
      msg.includes("exists")
    ) {
      throw new ProvisionError("email_exists", "email already registered");
    }
    throw new ProvisionError(
      "internal",
      `failed to create user: ${createErr?.message ?? "unknown"}`,
    );
  }

  const userId = created.user.id;

  // Helper: delete the just-created auth user to avoid orphans.
  const cleanup = async () => {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (_) {
      // best-effort; surfaced via the original error below
    }
  };

  try {
    // Step 3: insert tenant.
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name: input.businessName, status: "active" })
      .select("id")
      .single();
    if (tenantErr || !tenant) {
      throw new Error(`tenant insert failed: ${tenantErr?.message}`);
    }
    const tenantId = tenant.id as string;

    // Step 4: insert owner profile.
    const { error: profileErr } = await admin.from("profiles").insert({
      user_id: userId,
      tenant_id: tenantId,
      role: "owner",
      full_name: input.ownerFullName || null,
    });
    if (profileErr) {
      throw new Error(`profile insert failed: ${profileErr.message}`);
    }

    // Step 5: insert default Main Branch.
    const { error: branchErr } = await admin.from("branches").insert({
      tenant_id: tenantId,
      name: "Main Branch",
    });
    if (branchErr) {
      throw new Error(`branch insert failed: ${branchErr.message}`);
    }

    return {
      tenantId,
      businessName: input.businessName,
      ownerEmail: input.ownerEmail,
      tempPassword: password,
    };
  } catch (err) {
    // Any DB step failed after user creation -> remove the orphan user.
    await cleanup();
    throw new ProvisionError(
      "internal",
      err instanceof Error ? err.message : "provisioning failed",
    );
  }
}
