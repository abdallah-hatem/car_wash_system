# Plan 2 — Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the platform-owner admin console — seed the first platform admin, an Edge Function to onboard a business + owner (service_role), enforced suspend via the auth hook, and an i18n/RTL/responsive admin UI to list and activate/suspend businesses.

**Architecture:** Privileged user creation runs in a Deno Edge Function gated by an authoritative platform-admin check; listing/suspending tenants uses the normal anon client under existing RLS; suspend is enforced by withholding the tenant claim in the auth hook for non-active tenants.

**Tech Stack:** Supabase Edge Functions (Deno), Postgres + pgTAP, React + Vite + TS, Tailwind v3 + shadcn (v2), react-i18next, Vitest.

**Existing context:**
- Auth hook: `supabase/migrations/0007_auth_hook.sql` defines `custom_access_token_hook` (injects tenant_id/role/is_platform_admin). RLS in `0008_rls.sql` (incl. `is_platform_admin()`, `current_tenant_id()`, `tenant_self_read`/`tenant_admin_manage` on `tenants`, `platform_admins` locked down).
- `/admin` route is guarded by `RequireAdmin` and rendered inside `AppHeader` (`src/routes.tsx`); currently an index placeholder div.
- i18n: `src/i18n/locales/{en,ar}.json`, parity enforced by `src/i18n/locales.test.ts`. Standing UI rule in CLAUDE.md (responsive, i18n, RTL-correct, verify both directions).
- Local Supabase ports shifted to 5434x (API 54341, DB 54332). shadcn pinned v2 (`npx shadcn@2.10.0 add`).
- supabase-js client at `src/lib/supabase.ts` (typed via `src/lib/database.types.ts`).

**File structure:**
- Create: `supabase/seed.sql`
- Create: `supabase/migrations/0009_auth_hook_suspend.sql`; modify `supabase/tests/0007_auth_hook_test.sql` (add suspended case) or add `supabase/tests/0009_suspend_test.sql`
- Create: `supabase/functions/create-business/index.ts`, `supabase/functions/create-business/index.test.ts`, `supabase/functions/_shared/cors.ts`
- Create: `src/pages/admin/BusinessesPage.tsx`, `src/components/admin/CreateBusinessDialog.tsx`, `src/lib/admin.ts` (data helpers)
- Create: `src/lib/admin.test.ts` (pure helpers e.g. temp-password presentation / form validation)
- Modify: `src/routes.tsx`, `src/i18n/locales/{en,ar}.json`, CLAUDE.md (prod bootstrap note)

---

## Task 1: Seed file (platform admin + demo data)

**Files:** Create `supabase/seed.sql`.

- [ ] **Step 1: Write `supabase/seed.sql`.** Runs on `supabase db reset`. Idempotent via fixed UUIDs + `on conflict do nothing`.
```sql
-- Local dev seed. Recreated on every `supabase db reset`. NOT used in production.
-- Requires pgcrypto for crypt()/gen_salt() (available in Supabase Postgres).

-- ── Platform owner: admin@sudsly.test / admin123 ─────────────────────────────
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-0000000ad617',
  'authenticated', 'authenticated', 'admin@sudsly.test',
  crypt('admin123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}'
) on conflict (id) do nothing;

insert into public.platform_admins (user_id)
  values ('00000000-0000-0000-0000-0000000ad617') on conflict do nothing;

-- ── Demo tenant + owner: owner@demo.test / password123 ───────────────────────
insert into public.tenants (id, name)
  values ('00000000-0000-0000-0000-00000000de70', 'Demo Carwash') on conflict (id) do nothing;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-00000000be71',
  'authenticated', 'authenticated', 'owner@demo.test',
  crypt('password123', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Demo Owner"}'
) on conflict (id) do nothing;

insert into public.profiles (user_id, tenant_id, role, full_name)
  values ('00000000-0000-0000-0000-00000000be71',
          '00000000-0000-0000-0000-00000000de70', 'owner', 'Demo Owner')
  on conflict (user_id) do nothing;

insert into public.branches (tenant_id, name)
  values ('00000000-0000-0000-0000-00000000de70', 'Main Branch')
  on conflict do nothing;
```
NOTE: GoTrue also expects an `auth.identities` row for email login in some versions. If, after Step 2, login as these users fails (but the rows exist), add matching `auth.identities` inserts (provider `email`, `provider_id` = email, `user_id` = the user id, `identity_data` jsonb with `sub` + `email`). Verify empirically in Step 2.

- [ ] **Step 2: Reset + verify login works.**
Run: `npx supabase db reset` (applies migrations + seed). Then verify both accounts can actually authenticate via the local GoTrue:
```bash
# read anon key/url
npx supabase status
# attempt a password grant for each (expect a JSON with access_token)
curl -s "http://127.0.0.1:54341/auth/v1/token?grant_type=password" \
  -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" \
  -d '{"email":"admin@sudsly.test","password":"admin123"}' | head -c 200
```
Expected: a JSON access token (not an error). Repeat for `owner@demo.test`. If it errors with "Database error querying schema" or invalid login, add the `auth.identities` rows (see note) and re-reset. Decode the admin's token (middle JWT segment) and confirm `is_platform_admin: true`; the owner's token has `tenant_id` set.

- [ ] **Step 3: Commit**
```bash
git add supabase/seed.sql
git commit -m "feat(admin): local seed for platform admin + demo tenant"
```

---

## Task 2: Enforced suspend in the auth hook (TDD)

**Files:** Create `supabase/migrations/0009_auth_hook_suspend.sql`, `supabase/tests/0009_suspend_test.sql`.

- [ ] **Step 1: Write failing test** `supabase/tests/0009_suspend_test.sql`. Seeds an active and a suspended tenant, each with a user+profile, and asserts the hook's claim behavior.
```sql
begin;
select plan(3);

insert into public.tenants (id, name, status) values
  ('00000000-0000-0000-0000-0000000ac001', 'ActiveCo', 'active'),
  ('00000000-0000-0000-0000-0000005u5901', 'SuspendedCo', 'suspended');
insert into auth.users (instance_id, id, aud, role, email) values
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000u511','authenticated','authenticated','a@x.test'),
  ('00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-00000000u522','authenticated','authenticated','s@x.test');
insert into public.profiles (user_id, tenant_id, role) values
  ('00000000-0000-0000-0000-00000000u511','00000000-0000-0000-0000-0000000ac001','owner'),
  ('00000000-0000-0000-0000-00000000u522','00000000-0000-0000-0000-0000005u5901','owner');

-- active tenant -> tenant_id claim present
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id','00000000-0000-0000-0000-00000000u511','claims','{}'::jsonb))
    -> 'claims' ->> 'tenant_id',
  '00000000-0000-0000-0000-0000000ac001',
  'active tenant gets tenant_id claim');

-- suspended tenant -> NO tenant_id claim
select ok(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id','00000000-0000-0000-0000-00000000u522','claims','{}'::jsonb))
    -> 'claims' ->> 'tenant_id') is null,
  'suspended tenant gets no tenant_id claim');

-- suspended tenant user is still a valid event with is_platform_admin=false
select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id','00000000-0000-0000-0000-00000000u522','claims','{}'::jsonb))
    -> 'claims' ->> 'is_platform_admin',
  'false',
  'suspended tenant user still gets is_platform_admin=false');

select * from finish();
rollback;
```
(Use UUID-valid hex only — adjust the example ids to valid hex, e.g. `...ac001`, `...5901`, `...0511`, `...0522`. Ensure all id literals are valid UUIDs.)

- [ ] **Step 2: Run `npx supabase test db` — confirm FAIL** (current hook ignores status, so the suspended case returns a tenant_id).

- [ ] **Step 3: Write migration** `supabase/migrations/0009_auth_hook_suspend.sql` — replace the function so the profile lookup joins tenants and gates on status.
```sql
create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  claims    jsonb := event -> 'claims';
  uid       uuid  := (event ->> 'user_id')::uuid;
  prof      record;
  is_admin  boolean;
begin
  select p.tenant_id, p.role
    into prof
    from public.profiles p
    join public.tenants t on t.id = p.tenant_id
    where p.user_id = uid and t.status = 'active';
  if found then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(prof.tenant_id::text));
    claims := jsonb_set(claims, '{role}',      to_jsonb(prof.role::text));
  end if;

  select exists(select 1 from public.platform_admins where user_id = uid) into is_admin;
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(is_admin));

  return jsonb_set(event, '{claims}', claims);
end;
$$;
```

- [ ] **Step 4: Run `npx supabase test db`** — the suspend test passes AND the existing `0007_auth_hook_test.sql` still passes (its seeded tenant defaults to status `active`). Confirm all files pass.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/0009_auth_hook_suspend.sql supabase/tests/0009_suspend_test.sql
git commit -m "feat(admin): enforce tenant suspension in auth hook"
```

---

## Task 3: `create-business` Edge Function

**Files:** Create `supabase/functions/_shared/cors.ts`, `supabase/functions/create-business/index.ts`, `supabase/functions/create-business/index.test.ts`.

- [ ] **Step 1: CORS helper** `supabase/functions/_shared/cors.ts`
```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
```

- [ ] **Step 2: Implement** `supabase/functions/create-business/index.ts`
```ts
import { createClient } from "jsr:@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function tempPassword(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) + "aA1"
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405)

  const authHeader = req.headers.get("Authorization") ?? ""
  const jwt = authHeader.replace(/^Bearer\s+/i, "")
  if (!jwt) return json({ error: "missing_token" }, 401)

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // identify caller
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData.user) return json({ error: "invalid_token" }, 401)

  // authoritative platform-admin check
  const { data: pa } = await admin
    .from("platform_admins").select("user_id").eq("user_id", userData.user.id).maybeSingle()
  if (!pa) return json({ error: "forbidden" }, 403)

  let body: { businessName?: string; ownerEmail?: string; ownerFullName?: string }
  try { body = await req.json() } catch { return json({ error: "invalid_json" }, 400) }
  const { businessName, ownerEmail, ownerFullName } = body
  if (!businessName?.trim() || !ownerEmail?.trim())
    return json({ error: "missing_fields" }, 400)

  // 1. create the auth user
  const password = tempPassword()
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: ownerEmail.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: ownerFullName ?? null },
  })
  if (createErr || !created.user) {
    const dup = (createErr?.message ?? "").toLowerCase().includes("already")
    return json({ error: dup ? "email_exists" : "create_user_failed" }, dup ? 409 : 500)
  }
  const ownerId = created.user.id

  // 2-4. tenant + profile + default branch; on failure clean up the auth user
  try {
    const { data: tenant, error: tErr } = await admin
      .from("tenants").insert({ name: businessName.trim() }).select("id").single()
    if (tErr) throw tErr
    const { error: pErr } = await admin
      .from("profiles").insert({ user_id: ownerId, tenant_id: tenant.id, role: "owner", full_name: ownerFullName ?? null })
    if (pErr) throw pErr
    const { error: bErr } = await admin
      .from("branches").insert({ tenant_id: tenant.id, name: "Main Branch" })
    if (bErr) throw bErr

    return json({ tenantId: tenant.id, businessName: businessName.trim(), ownerEmail: ownerEmail.trim(), tempPassword: password }, 201)
  } catch (_e) {
    await admin.auth.admin.deleteUser(ownerId) // rollback orphan
    return json({ error: "provisioning_failed" }, 500)
  }
})
```

- [ ] **Step 3: Register function config.** Ensure `supabase/config.toml` has (add if missing):
```toml
[functions.create-business]
verify_jwt = false
```
(We verify the JWT ourselves inside the function so we can return clean JSON errors.)

- [ ] **Step 4: Write a Deno test** `supabase/functions/create-business/index.test.ts` for the pure `tempPassword()` shape and (if feasible) auth gating. Minimum:
```ts
import { assert } from "jsr:@std/assert"
// Re-implement-free: import the password generator by extracting it. If not exported,
// test via the running function (Step 5). At minimum assert the function file parses:
Deno.test("module imports", async () => {
  await import("./index.ts").catch(() => {}) // Deno.serve starts a listener; guarded import
  assert(true)
})
```
NOTE: Because `index.ts` calls `Deno.serve` at top level, prefer EXTRACTING `tempPassword` and the core `provisionBusiness(admin, body)` logic into `logic.ts` (no `Deno.serve`) and import THAT in tests. Refactor accordingly: `index.ts` becomes the HTTP shell calling `logic.ts`. Then test: `tempPassword()` returns ≥12 chars with a digit+upper+lower; `provisionBusiness` rejects missing fields. Keep the HTTP shell thin.

- [ ] **Step 5: Serve + integration check.** `npx supabase functions serve create-business --no-verify-jwt` in one shell; in another, get a platform-admin JWT (password grant for `admin@sudsly.test`) and POST:
```bash
curl -s -X POST "http://127.0.0.1:54341/functions/v1/create-business" \
  -H "Authorization: Bearer <ADMIN_JWT>" -H "Content-Type: application/json" \
  -d '{"businessName":"Acme Wash","ownerEmail":"acme@owner.test","ownerFullName":"Acme Owner"}'
```
Expected: `201` with `tempPassword`. Then POST again (same email) → `409 email_exists`. POST with a non-admin JWT (owner@demo.test) → `403`. Verify in DB that exactly one tenant "Acme Wash" + profile + "Main Branch" exist and no orphan user remains after the 409 attempt.

- [ ] **Step 6: Commit**
```bash
git add supabase/functions/ supabase/config.toml
git commit -m "feat(admin): create-business edge function (service_role, admin-gated)"
```

---

## Task 4: Admin UI — businesses list + create dialog (i18n/RTL/responsive)

**Files:** Create `src/lib/admin.ts`, `src/lib/admin.test.ts`, `src/pages/admin/BusinessesPage.tsx`, `src/components/admin/CreateBusinessDialog.tsx`. Modify `src/routes.tsx`, `src/i18n/locales/{en,ar}.json`.

- [ ] **Step 1: shadcn primitives**
```bash
npx shadcn@2.10.0 add table dialog badge
```
(`input`, `label`, `button`, `card` already exist.)

- [ ] **Step 2: Add locale keys** to BOTH `en.json` and `ar.json` (identical shape; real Arabic). Namespace `admin`:
```
admin.title ("Businesses" / "الأنشطة التجارية")
admin.newBusiness ("New business" / "نشاط تجاري جديد")
admin.colName / colStatus / colCreated / colActions
admin.statusActive ("Active" / "نشط"), admin.statusSuspended ("Suspended" / "موقوف")
admin.suspend ("Suspend"/"إيقاف"), admin.activate ("Activate"/"تفعيل")
admin.empty ("No businesses yet" / "لا توجد أنشطة بعد")
admin.create.title, create.businessName, create.ownerEmail, create.ownerName,
  create.submit ("Create"/"إنشاء"), create.cancel, create.creating
admin.create.successTitle ("Business created" / "تم إنشاء النشاط")
admin.create.tempPasswordLabel ("Temporary password (shown once)" / "كلمة مرور مؤقتة (تظهر مرة واحدة)")
admin.create.copy ("Copy"/"نسخ"), admin.create.done ("Done"/"تم")
admin.errors.email_exists, admin.errors.missing_fields, admin.errors.generic
```
Provide concrete Arabic strings for each. Run `npm test` → the locale-parity test must still pass.

- [ ] **Step 3: Data helpers** `src/lib/admin.ts`
```ts
import { supabase } from "./supabase"

export interface Business { id: string; name: string; status: "active" | "suspended"; created_at: string }

export async function listBusinesses(): Promise<Business[]> {
  const { data, error } = await supabase
    .from("tenants").select("id,name,status,created_at").order("created_at", { ascending: false })
  if (error) throw error
  return data as Business[]
}

export async function setBusinessStatus(id: string, status: "active" | "suspended"): Promise<void> {
  const { error } = await supabase.from("tenants").update({ status }).eq("id", id)
  if (error) throw error
}

export interface CreateBusinessInput { businessName: string; ownerEmail: string; ownerFullName: string }
export interface CreateBusinessResult { tenantId: string; businessName: string; ownerEmail: string; tempPassword: string }

export async function createBusiness(input: CreateBusinessInput): Promise<CreateBusinessResult> {
  const { data, error } = await supabase.functions.invoke("create-business", { body: input })
  if (error) {
    // supabase-js wraps non-2xx; try to read the JSON error code
    const code = (await (error as { context?: Response }).context?.json?.().catch(() => null))?.error
    throw new Error(code ?? "generic")
  }
  return data as CreateBusinessResult
}

/** form validation — pure, unit-tested */
export function validateCreate(input: Partial<CreateBusinessInput>): string | null {
  if (!input.businessName?.trim()) return "missing_fields"
  if (!input.ownerEmail?.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.ownerEmail)) return "missing_fields"
  return null
}
```

- [ ] **Step 4: Unit test** `src/lib/admin.test.ts` for `validateCreate` (valid input → null; blank name → "missing_fields"; bad email → "missing_fields"). Run `npm test` → passes.

- [ ] **Step 5: `CreateBusinessDialog.tsx`** — a shadcn `Dialog` with the three fields, calls `validateCreate` then `createBusiness`; on success switches to a "success" view showing `result.tempPassword` with a copy button (`navigator.clipboard.writeText`) and a Done button that closes + triggers `onCreated()`. On error, map the thrown code to `admin.errors.*` and show inline. All strings via `t`. Logical utilities, responsive.

- [ ] **Step 6: `BusinessesPage.tsx`** — on mount call `listBusinesses()`; render a responsive shadcn `Table` (name, status `Badge`, created date, actions). Each row has an Activate/Suspend button calling `setBusinessStatus` then refreshing. Header has the title + a "New business" button opening `CreateBusinessDialog`. Empty state uses `admin.empty`. All strings via `t`; logical utilities; on small screens the table should scroll horizontally within a container (no page overflow) or stack — ensure no layout break at 375px.

- [ ] **Step 7: Wire route** in `src/routes.tsx` — replace the `/admin` index placeholder element with `<BusinessesPage/>` (keep it under `RequireAdmin` + the AppHeader layout).

- [ ] **Step 8: Verify** `npm run build` + `npm test` pass. Commit.
```bash
git add src/ supabase/ 2>/dev/null; git add -A
git commit -m "feat(admin): businesses list + create-business dialog (i18n/RTL/responsive)"
```

---

## Task 5: Full-flow verification + suite + prod-bootstrap doc

**Files:** Modify CLAUDE.md. (Verification work; plus any fixes found.)

- [ ] **Step 1: Document the production bootstrap** in CLAUDE.md (Security or a new "Admin bootstrap" subsection): to create the first platform admin in production, create your user via the app, then run `insert into public.platform_admins (user_id) values ('<your-auth-uid>');` from the Supabase SQL editor (service_role). Note the local seed handles this automatically for dev.

- [ ] **Step 2: Full-flow integration check.** With local stack + `functions serve` running and `npm run dev`:
  1. Log in as `admin@sudsly.test` / `admin123` → lands on `/admin` (BusinessesPage), Demo Carwash listed.
  2. Create a business "QA Wash" with owner `qa@owner.test` → temp password shown once; QA Wash appears in the list.
  3. Log out, log in as `qa@owner.test` with the temp password → reaches `/app`.
  4. Back as admin, **Suspend** QA Wash. Re-log-in as `qa@owner.test` (forces a fresh token) → now routed to `/no-access` (suspend enforced). **Activate** → access restored on next login.
  Record the results. Fix anything that fails.

- [ ] **Step 3: Responsive × RTL check** of `/admin` (BusinessesPage + open CreateBusinessDialog) at 375px and 820px in EN and AR — no overflow, table usable, dialog fits, mirrors correctly, Arabic in Cairo. Fix any break.

- [ ] **Step 4: Full local suite** — paste output:
  - `npx supabase test db` (prior 31 + new suspend tests pass)
  - `npm test` (dir + claims + locale parity + admin validate pass)
  - `npm run build` (passes)
  - Edge: `deno test supabase/functions/create-business/` (logic tests pass) — if Deno isn't directly available, note it and rely on the Step 2 integration check.

- [ ] **Step 5: Commit**
```bash
git add CLAUDE.md
git commit -m "docs(admin): production platform-admin bootstrap steps"
```

---

## Definition of Done
- `supabase db reset` recreates working `admin@sudsly.test`/`admin123` (platform admin) and `owner@demo.test`/`password123` (tenant owner) logins.
- Admin can onboard a business via the Edge Function (admin-gated, service_role, atomic) and see the temp password once; non-admins get 403; duplicate email → 409 with no orphan.
- Suspending a business blocks its users (no tenant claim → `/no-access`) on next token; activating restores.
- Admin UI lists + toggles businesses, fully i18n/RTL/responsive (verified mobile+tablet, EN+AR), replacing the `/admin` placeholder.
- pgTAP (incl. suspend), Vitest (incl. validate + parity), Edge logic tests, and build all pass locally; full-flow verified.
- Production bootstrap documented in CLAUDE.md.
