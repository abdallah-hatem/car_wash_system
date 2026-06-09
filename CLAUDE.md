# Car Wash System — Project Instructions

Multi-tenant carwash SaaS. Stack: React + Vite + TypeScript, Tailwind + shadcn/ui,
Supabase (Postgres + Auth + RLS), PWA. See `docs/superpowers/specs/` and
`docs/superpowers/plans/` for the design and implementation plans.

## Branching & Shipping Workflow (REQUIRED)

Branches:
- `production` — stable, shipped code. Only merged into when we explicitly decide to ship.
- `dev` — integration branch. Features land here after passing locally.
- feature work happens locally, then pushes to `dev`.

Per feature, in order — do not skip steps:
1. Build the feature.
2. Write **all** unit tests, edge-case tests, and a **full-flow test** for it.
3. Run the complete test suite **locally** against Docker Supabase — everything green.
4. Push to `dev`.
5. Ship to `production` only on explicit go-ahead.

Never push to `production` without explicit permission.

## Local Testing

- Local Supabase runs in Docker via the Supabase CLI (`npx supabase start`).
- DB tests: pgTAP via `npx supabase test db`.
- Frontend unit tests: Vitest (`npm test`).
- A feature is not "done" until DB tests + unit tests + the full-flow test all pass locally.

## Git Identity

- Author: `Abdallah <ahkortam@gmail.com>`.
- Remote: `git@github.com:abdallah-hatem/car_wash_system.git`.

## Security

- Secrets live only in gitignored `.env.local` (local) / deploy env (prod). Never commit them.
- Frontend uses the Supabase anon key only; service_role key and DB password never touch client code.
- Multi-tenancy is enforced by Postgres RLS keyed on the `tenant_id` JWT claim. Every new
  operational table MUST carry `tenant_id` and get a `tenant_isolation` RLS policy + an isolation test.
