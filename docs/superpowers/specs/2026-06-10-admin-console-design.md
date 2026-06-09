# Plan 2 — Admin Console — Design

**Date:** 2026-06-10
**Status:** Approved
**Depends on:** Plan 1 (Foundation) — schema, RLS, auth hook, `/admin` guard, AppHeader.

## 1. Purpose

The platform owner's console to onboard and manage client carwash businesses:
create a business + its first owner, list businesses, and activate/suspend them.
This is what replaces hand-seeding real logins.

## 2. Locked decisions

- **Privileged create** runs in a Supabase **Edge Function** (`create-business`) using
  `service_role`, gated by an authoritative platform-admin check.
- **Owner credentials:** a **temp password generated server-side, shown once** in the UI.
- **Suspend = enforced block:** the auth hook withholds the tenant claim for suspended
  tenants (effective on next token refresh, ≤1h, for live sessions).
- **First platform admin:** local **seed** + a documented one-time production SQL step.
- **Onboarding also creates a default "Main Branch"** so Plan 3 isn't blocked.
- Local seed uses fixed dev passwords (`admin123`, `password123`) — Docker-only, not prod.

## 3. Components

### 3.1 Seed (`supabase/seed.sql`)
Runs on `supabase db reset`. Inserts via SQL (idempotent / guarded):
- Platform owner auth user `admin@sudsly.test` (bcrypt password via
  `crypt('admin123', gen_salt('bf'))`, `email_confirmed_at = now()`, `aud`/`role`
  `authenticated`, `instance_id` zero-uuid) + a `platform_admins` row.
- Demo tenant "Demo Carwash" + owner auth user `owner@demo.test` (`password123`) +
  `profiles` row (role `owner`) + a "Main Branch".
- Restores the test logins after every reset.

**Production bootstrap (documented, not seeded):** create your user through the app,
then `insert into platform_admins (user_id) values ('<your-uid>')` via the SQL editor
(service_role). Recorded in CLAUDE.md.

### 3.2 Edge Function `create-business` (`supabase/functions/create-business/index.ts`)
- **Input (JSON):** `{ businessName, ownerEmail, ownerFullName }`.
- **AuthZ:** read caller JWT from the `Authorization` header; with `service_role`, verify
  `exists(select 1 from platform_admins where user_id = <caller sub>)`. Reject 403 otherwise.
- **Action (service_role admin client):**
  1. Generate a random temp password (e.g. 16 chars).
  2. `auth.admin.createUser({ email: ownerEmail, password, email_confirm: true,
     user_metadata: { full_name: ownerFullName } })`.
  3. `insert into tenants (name) values (businessName) returning id`.
  4. `insert into profiles (user_id, tenant_id, role) values (newUser.id, tenantId, 'owner')`.
  5. `insert into branches (tenant_id, name) values (tenantId, 'Main Branch')`.
- **Atomicity:** on any failure after step 2, delete the created auth user (no orphans).
  Duplicate email → 409 with a clear message.
- **Output:** `{ tenantId, businessName, ownerEmail, tempPassword }` (password returned once).
- **CORS:** handle preflight; allow the app origin.

### 3.3 Auth hook change (new migration, e.g. `0009_auth_hook_suspend.sql`)
Replace `custom_access_token_hook` so the profile lookup joins `tenants` and injects
`tenant_id`/`role` **only when `tenants.status = 'active'`**. Suspended (or missing) →
omit tenant claims; `is_platform_admin` is still always set. Net effect: suspended
tenant users become "orphaned" and route to `/no-access`.

### 3.4 Admin UI (routes under existing `/admin` → `RequireAdmin` → AppHeader)
- **Businesses list page** (`src/pages/admin/BusinessesPage.tsx`): fetch all `tenants`
  (RLS `tenant_self_read` permits platform admin), render a responsive table — name,
  status badge, created date — with an Activate/Suspend action (updates `tenants.status`;
  RLS `tenant_admin_manage` permits) and a "New business" button.
- **Create dialog** (`src/components/admin/CreateBusinessDialog.tsx`): fields business
  name, owner email, owner full name; on submit calls the Edge Function via
  `supabase.functions.invoke('create-business', …)`; on success shows the **temp password
  once** with a copy button and a "done" acknowledgement; refreshes the list.
- shadcn primitives (`table`, `dialog`, `badge`, `input`, `label`, `button`). All strings
  in `en/ar` locale files; RTL-correct logical utilities; responsive (mobile + tablet).
- Replaces the `/admin` placeholder.

### 3.5 Data access
List + status toggle use the normal anon client with the platform-admin JWT (existing RLS
allows it). Only user creation needs the Edge Function. No new RLS policies required.

## 4. Error handling
- Edge Function: 401 (no/invalid JWT), 403 (not platform admin), 409 (duplicate email),
  400 (missing/invalid fields), 500 (unexpected) — all JSON `{ error }`. UI surfaces the
  message; keeps the dialog open on failure.
- Suspended-tenant login: user reaches `/no-access` (no error state needed).

## 5. Testing
- **pgTAP:** auth hook — active tenant → tenant_id claim present; suspended tenant →
  claim absent, `is_platform_admin` still correct. RLS — platform admin can update
  `tenants.status`; a tenant user cannot.
- **Edge Function (Deno test):** non-admin caller → 403; missing fields → 400; happy path
  creates user+tenant+profile+branch and returns a temp password; duplicate email → 409
  with no orphaned auth user.
- **Full-flow (workflow rule):** onboard via function → owner logs in → reaches `/app`;
  suspend → next session blocked at `/no-access`; reactivate → restored.
- **Vitest:** create-dialog form validation + temp-password reveal/copy logic.
- Full local suite (pgTAP + Vitest + build + Edge tests) green before pushing to `dev`.

## 6. Out of scope (deferred)
Usage metrics, billing/plans, support impersonation, editing owner email/password,
multi-owner tenants, email-invite flow (chose temp-password), and all tenant operational
features (Plan 3).
