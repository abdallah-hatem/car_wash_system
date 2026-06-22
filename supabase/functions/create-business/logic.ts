// Core, side-effect-light logic for the create-business edge function.
// Extracted from index.ts so it can be unit tested without starting an HTTP
// listener. provisionBusiness takes an injected supabase admin client so it
// can be mocked in tests.
//
// The owner is provisioned without a usable password, then emailed a Supabase
// set-password (invite) link via Resend. The link is also returned so the
// platform admin can copy/hand it over (email is best-effort).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { renderInviteEmail, sendEmail, type EmailLocale } from "../_shared/email.ts";

export interface ValidInput {
  businessName: string;
  ownerEmail: string;
  ownerFullName: string;
  appUrl?: string;
  locale: EmailLocale;
}

export interface ValidationError {
  error: "missing_fields";
}

export interface ProvisionResult {
  tenantId: string;
  businessName: string;
  ownerEmail: string;
  actionLink: string | null;
  emailed: boolean;
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

// A strong random password the owner never uses (they set their own via the link).
export function tempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digit = "23456789";
  const all = upper + lower + digit + "!@#$%^&*";

  const pick = (set: string) => set[randInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digit)];
  while (chars.length < 16) {
    chars.push(all[randInt(all.length)]);
  }
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

// Generate a Supabase set-password (recovery) action link, landing on /set-password.
// deno-lint-ignore no-explicit-any
async function setPasswordLink(admin: SupabaseClient<any, any, any>, email: string, appUrl?: string): Promise<string | null> {
  const redirectTo = appUrl ? `${appUrl.replace(/\/$/, "")}/set-password` : undefined;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (error) return null;
  // deno-lint-ignore no-explicit-any
  return ((data as any)?.properties?.action_link as string) ?? null;
}

// Basic, intentionally-loose email shape check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateInput(body: unknown): ValidInput | ValidationError {
  if (typeof body !== "object" || body === null) {
    return { error: "missing_fields" };
  }
  const b = body as Record<string, unknown>;

  const businessName = typeof b.businessName === "string" ? b.businessName.trim() : "";
  const ownerEmail = typeof b.ownerEmail === "string" ? b.ownerEmail.trim() : "";
  const ownerFullName = typeof b.ownerFullName === "string" ? b.ownerFullName.trim() : "";

  if (!businessName) return { error: "missing_fields" };
  if (!ownerEmail || !EMAIL_RE.test(ownerEmail)) {
    return { error: "missing_fields" };
  }

  const appUrl = typeof b.appUrl === "string" && b.appUrl.length > 0 ? b.appUrl : undefined;
  const locale: EmailLocale = b.locale === "ar" ? "ar" : "en";
  return { businessName, ownerEmail, ownerFullName, appUrl, locale };
}

// Steps 2-5: create auth user, tenant, owner profile, default branch; then email
// an invite link. On any DB failure after the auth user is created, the auth user
// is deleted so we never leave an orphan.
export async function provisionBusiness(
  // deno-lint-ignore no-explicit-any
  admin: SupabaseClient<any, any, any>,
  input: ValidInput,
): Promise<ProvisionResult> {
  // Step 2: create the auth user (random password — the owner sets their own via the link).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: input.ownerEmail,
    password: tempPassword(),
    email_confirm: true,
    user_metadata: { full_name: input.ownerFullName },
  });

  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      throw new ProvisionError("email_exists", "email already registered");
    }
    throw new ProvisionError("internal", `failed to create user: ${createErr?.message ?? "unknown"}`);
  }

  const userId = created.user.id;
  const cleanup = async () => {
    try { await admin.auth.admin.deleteUser(userId); } catch (_) { /* best-effort */ }
  };

  let tenantId = "";
  try {
    // Step 3: insert tenant.
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({ name: input.businessName, status: "active" })
      .select("id")
      .single();
    if (tenantErr || !tenant) throw new Error(`tenant insert failed: ${tenantErr?.message}`);
    tenantId = tenant.id as string;

    // Step 4: insert owner profile.
    const { error: profileErr } = await admin.from("profiles").insert({
      user_id: userId,
      tenant_id: tenantId,
      role: "owner",
      full_name: input.ownerFullName || null,
    });
    if (profileErr) throw new Error(`profile insert failed: ${profileErr.message}`);

    // Step 5: insert default Main Branch.
    const { error: branchErr } = await admin.from("branches").insert({
      tenant_id: tenantId,
      name: "Main Branch",
    });
    if (branchErr) throw new Error(`branch insert failed: ${branchErr.message}`);
  } catch (err) {
    await cleanup();
    throw new ProvisionError("internal", err instanceof Error ? err.message : "provisioning failed");
  }

  // Provisioned — best-effort invite (email may be off until the domain verifies;
  // the link is returned regardless so the admin can hand it over).
  const actionLink = await setPasswordLink(admin, input.ownerEmail, input.appUrl);
  let emailed = false;
  if (actionLink) {
    const { subject, html } = renderInviteEmail({
      name: input.ownerFullName || undefined,
      businessName: input.businessName,
      actionUrl: actionLink,
      locale: input.locale,
    });
    emailed = (await sendEmail(input.ownerEmail, subject, html)).ok;
  }

  return {
    tenantId,
    businessName: input.businessName,
    ownerEmail: input.ownerEmail,
    actionLink,
    emailed,
  };
}
