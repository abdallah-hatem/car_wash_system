# WashFlow

Multi-tenant car-wash management SaaS — run the queue, payments, customers, vehicles,
branches, and staff for one or many car washes. Bilingual (English / Arabic, RTL),
tablet-first PWA.

**Stack:** React + Vite + TypeScript · Tailwind + shadcn/ui · Supabase (Postgres + Auth + RLS).

## Local development

Requires Docker (for local Supabase) and Node.

```bash
npm install
npx supabase start          # local Postgres + Auth in Docker
cp .env.example .env.local  # fill in the local Supabase URL + anon key
npm run dev
```

Seeded local logins are in `TESTING.md` (gitignored).

## Testing

```bash
npx supabase test db        # pgTAP DB / RLS tests
npm test                    # Vitest unit tests (src/)
npm run build               # type-check + production build
```

A change isn't done until DB tests + unit tests + build all pass locally.

## Environments & shipping

| Env | Branch → URL | Supabase |
|-----|--------------|----------|
| Local | — (Docker) | local |
| Testing | `dev` → car-wash-system-testing.vercel.app | `car_wash_staging` |
| Production | `production` → car-wash-system-six.vercel.app | `car_wash` |

Develop + test locally → push to `dev` (auto-deploys to testing) → ship to `production`
only on explicit go-ahead. Deploy runbook: **`DEPLOY.md`**.

## Key docs

- **`docs/BUSINESS_LOGIC.md`** — living source of truth for the domain model, roles, security, and flows.
- **`CLAUDE.md`** — project conventions, branching/shipping workflow, and environment rules.
- **`docs/superpowers/specs/`** & **`plans/`** — per-feature design specs and implementation plans.
