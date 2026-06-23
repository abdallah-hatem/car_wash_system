# Car Wash System — Project Instructions

Multi-tenant carwash SaaS. Stack: React + Vite + TypeScript, Tailwind + shadcn/ui,
Supabase (Postgres + Auth + RLS), PWA. See `docs/superpowers/specs/` and
`docs/superpowers/plans/` for the design and implementation plans.

## Business Logic Doc (REQUIRED to maintain)

`docs/BUSINESS_LOGIC.md` is the living source of truth for the domain model, roles,
security model, and all business flows. **Read it at the start of work to recover context.**

Whenever a change touches business logic, a flow, the data model, roles/permissions, the
tenancy/security model, or scope (features added/removed/deferred), you **MUST update
`docs/BUSINESS_LOGIC.md` in the same change** and bump its "Last updated" line. Keep it
accurate to what the code actually does; mark not-yet-built items as **Planned**. Treat a PR
that changes behavior without updating this file as incomplete.

## Branching & Shipping Workflow (REQUIRED)

Branches:
- `production` — stable, shipped code. Only merged into when we explicitly decide to ship.
- `dev` — integration branch. Features land here after passing locally.
- feature work happens locally, then pushes to `dev`.

Per feature, in order — do not skip steps:
1. Build the feature.
2. Write **all** unit tests, edge-case tests, and a **full-flow test** for it.
3. Run the complete test suite **locally** against Docker Supabase — everything green.
4. **Verify it RUNNING locally in a real browser** — drive the app yourself against
   local Docker Supabase (`npm run dev` + a browser you control: the Playwright MCP /
   Chrome MCP / Claude-in-Chrome, or any agentic browser tool). Actually click through
   the changed flow and confirm the behavior before pushing. **Do NOT push to `dev` to
   "see if it works" — `dev` auto-deploys to the shared staging site; treating staging
   as your test bed breaks QA for everyone.** Staging is for the user's review of
   already-verified work, not your first look at it.
5. Push to `dev` (→ staging) only after steps 3 **and** 4 pass locally.
6. Ship to `production` only on explicit go-ahead.

Never push to `production` without explicit permission. Never push UNVERIFIED code to
`dev` — local browser verification (step 4) is mandatory, not optional.

## Deployment Environments (REQUIRED)

Three environments, each with its **own Supabase project (DB)** and Vercel deploy. Always
develop and test locally first; only green code reaches `dev`.

| Env | Branch → Vercel | Supabase project (ref) |
|-----|-----------------|------------------------|
| **Local** | — (Docker Supabase) | local, disposable |
| **Testing / staging** | `dev` → `car-wash-system-testing.vercel.app` | `car_wash_staging` (`tjvnojfsvcyvlvpqzjft`) |
| **Production** | `production` → `car-wash-system-six.vercel.app` | `car_wash` (`vgxqqdwcmnburttgjwsf`) |

Rules:
- **Develop + run the full suite locally** (pgTAP + Vitest + build, all green) **before pushing.**
- `dev` **auto-deploys to the shared testing site** — a broken push breaks QA for everyone.
  Never push WIP/red code to `dev`; push coherent, green increments and keep messy work local.
- `production` deploys only from the `production` branch, **only on explicit go-ahead.**
- Each env has its own data, auth hook, and platform admin — **testing must never run against
  the production DB.** Cloud creds (DB passwords, access token, admin logins) live only in
  gitignored `supabase_credentials.md` / `admin_creds.md`; env-var setup is in `DEPLOY.md`.
  Never commit secrets.

## UI Conventions (REQUIRED for every screen)

- **Responsive, tablet-first.** Every screen must work at mobile (~375px) and tablet
  (~768–1024px): no horizontal overflow, tap targets ≥ 44px, readable type.
- **Internationalized.** No hardcoded user-facing strings — all text comes from the i18n
  locale files (`src/i18n/locales/{en,ar}.json`) via `useTranslation()`. `en` and `ar`
  must have identical key sets (enforced by `src/i18n/locales.test.ts`).
- **RTL-correct.** Use logical Tailwind utilities (`ps-/pe-/ms-/me-/text-start/text-end/
  start-/end-/rounded-s-/rounded-e-`), not physical ones (`pl-/pr-/ml-/mr-/left-/right-`),
  so layouts mirror under Arabic. CSS transforms (e.g. `translateX`) don't auto-flip —
  add a `[dir="rtl"]` keyframe/override when needed.
- **Verify in BOTH directions.** New/changed screens must be checked at mobile + tablet in
  LTR (English) AND RTL (Arabic) before merging — mirroring can break layouts the LTR pass
  misses.

## Local Testing

- Local Supabase runs in Docker via the Supabase CLI (`npx supabase start`).
- DB tests: pgTAP via `npx supabase test db`. **Note:** these run against the LIVE local DB,
  not a pristine one — so app-created rows (e.g. from browser integration testing) are
  visible. A pgTAP test that runs as superuser must **scope its assertions** (by `row_id`,
  tenant, or a before/after delta), never assert an absolute global count like
  `count(audit_log …) = 1`. Tests run under a tenant JWT claim are already RLS-scoped.
- Frontend unit tests: Vitest (`npm test`) — scoped to `src/` (the Deno edge-function tests
  run via `deno test`, not Vitest).
- A feature is not "done" until DB tests + unit tests + the full-flow test all pass locally.
- **Gate pushes on a green suite** — run pgTAP + Vitest + build and only push if all pass
  (don't run the push unconditionally after the tests).

## Git Identity

- Author: `Abdallah <ahkortam@gmail.com>`.
- Remote: `git@github.com:abdallah-hatem/car_wash_system.git`.

## Security

- Secrets live only in gitignored `.env.local` (local) / deploy env (prod). Never commit them.
- Frontend uses the Supabase anon key only; service_role key and DB password never touch client code.
- Multi-tenancy is enforced by Postgres RLS keyed on the `tenant_id` JWT claim. Every new
  operational table MUST carry `tenant_id` and get a `tenant_isolation` RLS policy + an isolation test.

### ⚠️ Pending: rotate the Supabase DB password before production

The original Supabase DB password was shared in a chat transcript and must be considered
compromised. **Before going to production**, rotate it in the Supabase dashboard
(Settings → Database → reset password) and update any deploy env accordingly. The
`.env.local` anon key and the seeded `owner@demo.test` / `password123` login are
local-Docker-only and not production secrets.

## Admin bootstrap

### Local development

`supabase/seed.sql` runs automatically on `npx supabase db reset` and inserts the platform
admin row for `admin@sudsly.test` (user id `00000000-0000-0000-0000-0000000ad617`) into
`public.platform_admins`. No manual step needed locally.

### Production (first platform admin)

There is no sign-up flow for platform admins — they must be promoted after account creation:

1. Create your account via the normal app sign-up or Supabase Auth dashboard.
2. Find your Auth user ID in the Supabase dashboard → Authentication → Users.
3. Open the **SQL Editor** (use the service_role context, not the anon key) and run:

```sql
insert into public.platform_admins (user_id)
values ('<your-auth-user-id>');
```

Once that row exists the user's next login JWT will carry `is_platform_admin: true` (injected
by the `custom_access_token_hook`) and the `/admin` route will become accessible.

**Never expose the service_role key to the client.** Run this SQL only from the Supabase
dashboard SQL editor or a trusted server-side script.
