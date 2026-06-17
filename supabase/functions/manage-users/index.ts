// manage-users edge function — SECURITY SENSITIVE.
//
// Owner-only CRUD for branch-scoped sub-users (managers). The caller's JWT is
// verified, then their identity is authoritatively resolved to an ACTIVE OWNER
// of a tenant via a service_role query (NOT trusting any client-supplied claim).
// Every action is scoped to that owner's tenant and may only target `manager`
// rows in it. verify_jwt is disabled in config.toml so we own auth + error bodies.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  ManageError,
  validateInput,
  createUser,
  updateUser,
  setActive,
  deleteUser,
  resetPassword,
  listUsers,
} from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function statusForError(code: ManageError["code"]): number {
  switch (code) {
    case "invalid": return 400;
    case "email_exists": return 409;
    case "not_found": return 404;
    default: return 500;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!token) return json({ error: "missing_token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify token -> caller id.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "invalid_token" }, 401);
  const callerId = userData.user.id;

  // Authoritative owner gate: caller must be an ACTIVE OWNER. Derive tenant_id here;
  // never trust a client-supplied tenant_id.
  const { data: ownerProfile, error: ownerErr } = await admin
    .from("profiles")
    .select("tenant_id, role, is_active")
    .eq("user_id", callerId)
    .maybeSingle();
  if (ownerErr) return json({ error: "internal_error" }, 500);
  if (!ownerProfile || ownerProfile.role !== "owner" || ownerProfile.is_active !== true) {
    return json({ error: "forbidden" }, 403);
  }
  const tenantId = ownerProfile.tenant_id as string;

  let body: unknown;
  try { body = await req.json(); } catch (_) { return json({ error: "invalid_json" }, 400); }

  const input = validateInput(body);
  if ("error" in input) return json({ error: input.error }, 400);

  try {
    switch (input.action) {
      case "create": {
        const { userId } = await createUser(admin, tenantId, input);
        return json({ userId }, 201);
      }
      case "list": return json({ users: await listUsers(admin, tenantId) }, 200);
      case "update": await updateUser(admin, tenantId, input); return json({ ok: true }, 200);
      case "setActive": await setActive(admin, tenantId, input); return json({ ok: true }, 200);
      case "delete": await deleteUser(admin, tenantId, input); return json({ ok: true }, 200);
      case "resetPassword": await resetPassword(admin, tenantId, input); return json({ ok: true }, 200);
    }
  } catch (err) {
    if (err instanceof ManageError) return json({ error: err.code }, statusForError(err.code));
    return json({ error: "internal_error" }, 500);
  }
});
