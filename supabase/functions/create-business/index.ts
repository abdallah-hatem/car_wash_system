// create-business edge function — SECURITY SENSITIVE.
//
// Onboards a carwash business + its owner using the service_role key.
// Callable ONLY by platform admins: the caller's JWT is verified, then the
// caller's identity is authoritatively checked against public.platform_admins
// via a service_role query (NOT trusting any client-supplied claim).
//
// verify_jwt is disabled in config.toml so we own auth and can return clean
// JSON error bodies.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  ProvisionError,
  provisionBusiness,
  validateInput,
} from "./logic.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  // 1. Extract caller JWT.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!token) {
    return json({ error: "missing token" }, 401);
  }

  // Service-role admin client (bypasses RLS). Used for both the authoritative
  // admin check and the provisioning writes.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verify the token and resolve the caller's user id.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return json({ error: "invalid token" }, 401);
  }
  const callerId = userData.user.id;

  // 2. Authoritative admin gate: query platform_admins with service_role.
  //    We do NOT trust is_platform_admin claims from the JWT.
  const { data: adminRow, error: adminErr } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", callerId)
    .maybeSingle();
  if (adminErr) {
    return json({ error: "internal_error" }, 500);
  }
  if (!adminRow) {
    return json({ error: "forbidden" }, 403);
  }

  // 3. Parse + validate body.
  let body: unknown;
  try {
    body = await req.json();
  } catch (_) {
    return json({ error: "invalid_json" }, 400);
  }

  const validated = validateInput(body);
  if ("error" in validated) {
    return json({ error: validated.error }, 400);
  }

  // 4. Provision with service_role (atomic w/ orphan cleanup in logic).
  try {
    const result = await provisionBusiness(admin, validated);
    return json(result, 201);
  } catch (err) {
    if (err instanceof ProvisionError) {
      if (err.code === "email_exists") {
        return json({ error: "email_exists" }, 409);
      }
      return json({ error: "internal_error" }, 500);
    }
    return json({ error: "internal_error" }, 500);
  }
});
