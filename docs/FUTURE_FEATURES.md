# WashFlow — Future Features / Roadmap

> Ideas captured but **not yet built**. Each gets its own brainstorm → spec → plan before
> implementation. (Built features live in `docs/BUSINESS_LOGIC.md`.)

---

## 1. Roles & Permissions — branch-scoped sub-users  ⏳ to discuss (raised 2026-06-15)

**Goal:** an owner with multiple branches can add other users (managers / admins / cashiers)
to help run the business, **scoped to specific branches** and with access to **specific
features only**.

**What the owner wants to be able to do:**
- Invite / create additional users under their tenant (today only the single onboarding owner logs in).
- Assign each user to **one or more branches** (e.g. "run Branch A only").
- Give each user/role **feature-level permissions** (e.g. operate the queue + take payments,
  but not edit packages/staff; see dashboards for their own branch only).
- Their data + actions are **scoped to their assigned branch(es)** — a Branch-A manager can't
  see Branch-B's washes/customers.

**Implications to design (spec later):**
- **Data model:** a `memberships` / `user_branches` table linking auth user ↔ tenant ↔
  branch(es) ↔ role/permissions. Generalizes today's single-row `profiles` (owner/manager).
  Decide: predefined roles (owner / manager / cashier) vs. granular permission flags.
- **RLS:** add **branch-level** scoping on top of tenant isolation — owner sees all branches;
  branch-scoped users see only their branch(es). Either the auth hook injects the user's
  branch scope + permissions into the JWT, or RLS policies read the memberships table.
- **Auth hook:** carry role / branch-scope / permission claims at token issue.
- **Invite/onboarding flow:** owner adds a user (email) → access scoped to assigned branches.
  Invite-by-email (needs an email provider) vs. owner-sets-a-temp-password (like the existing
  `create-business` admin flow).
- **UI gating:** hide/disable features per the user's permissions; the navbar **branch
  switcher** limited to their assigned branches.

**Open questions for the discussion:**
- Predefined roles vs. granular per-feature toggles (or both)?
- Can a user belong to multiple branches? Multiple tenants?
- Which features are permission-gated (queue, payments, customers, packages, staff, branches,
  dashboard, washes history, future reports)?
- How do branch-scoped users affect existing flows (New Wash branch pre-selected, dashboard, etc.)?

---

## 2. Other known deferred items
- **Analytics page** — busiest days/times, avg wait vs. service time, revenue trends,
  cancellations-by-reason. The Washes timing data (`created_at`/`started_at`/`completed_at`/
  `cancelled_at`) is already captured for this.
- **Long-wait (>15 min) push** — Phase 3 of notifications (needs `pg_cron`). The 3 DB-driven
  push events (queued / completed / done-unpaid) are already live on staging.
- **Production notifications** — replicate the staging push setup (VAPID secrets, deploy
  `notify-wash-event`, Database Webhook) on the prod `car_wash` Supabase + Vercel VAPID var.
- **Realtime live queue** — Supabase Realtime so the open tablet updates without a refresh
  (deferred by decision; push covers the away-from-counter case).
- **react-day-picker v8 → v9** — official React 19 support (currently v8 via `legacy-peer-deps`;
  works fine).
- **Rotate the staging/prod DB passwords + revoke the Supabase access token** that passed
  through chat during setup (see CLAUDE.md / `supabase_credentials.md`).
