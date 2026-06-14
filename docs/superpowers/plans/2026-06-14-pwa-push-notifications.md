# PWA + Web Push — Implementation Plan

> **For agentic workers:** execute task-by-task via subagent-driven development. Each phase is
> shippable: build → all tests + full-flow → local gate (pgTAP + Vitest + build green) → push to `dev`.

**Goal:** Installable PWA + web push for 4 wash events + realtime live queue. See the design:
`docs/superpowers/specs/2026-06-14-pwa-push-notifications-design.md`.

**Tech:** vite-plugin-pwa (injectManifest) + Workbox, Web Push API + VAPID, Supabase
(push_subscriptions table, `send-push` edge fn, Database Webhooks, pg_cron), supabase Realtime.

---

## Phase 1 — PWA foundation

**Files:** `package.json` (dep), `vite.config.ts` (plugin), `src/sw.ts` (custom SW),
`public/manifest.webmanifest` or plugin-generated, `public/icons/*` (192/512 maskable),
`index.html` (theme-color/apple meta), `src/pwa.ts` (register + update prompt), `src/lib/notify/*`
(pure helpers + tests), i18n keys.

- [ ] Install `vite-plugin-pwa` (+ workbox). Configure `injectManifest` strategy, `registerType: 'autoUpdate'`, manifest (name "WashFlow", short_name "WashFlow", `display: standalone`, `theme_color` teal `#0d9488`-ish per `--primary`, `background_color`, `start_url: '/'`, maskable 192 + 512 icons).
- [ ] Generate maskable PWA icons (192, 512) — teal background + WashFlow mark; place in `public/`.
- [ ] `src/sw.ts` (injectManifest custom SW): `precacheAndRoute(self.__WB_MANIFEST)`, `self.skipWaiting()`/`clientsClaim()`, an offline app-shell navigation fallback, and **push handlers** ready: `self.addEventListener('push', …)` → `showNotification(title, { body, icon, data:{url} })`; `notificationclick` → focus an existing client or `openWindow(url)` (default `/app/queue`).
- [ ] `index.html`: add `theme-color` meta + apple-touch-icon + (manifest link injected by plugin).
- [ ] Register SW in app entry with an **update toast** ("New version — reload"). Ensure autoUpdate doesn't strand users on a stale bundle.
- [ ] Pure helper `urlBase64ToUint8Array(base64)` (VAPID key → Uint8Array) in `src/lib/notify/push.ts` + Vitest tests (used in Phase 2; add now since it's pure).
- [ ] i18n: `pwa.updateAvailable`, `pwa.reload` (en/ar parity).
- [ ] Verify: app installable (manifest + SW registered, Lighthouse PWA basics), SW push handler unit-reasoned; `npm test` + `npm run build` green. Local gate → push to `dev`.

## Phase 2 — Web push core (3 DB-driven events)

**Files:** migration `00NN_push_subscriptions.sql` (+ RLS), pgTAP test, `supabase/functions/send-push/`, `src/lib/notify/subscriptions.ts` + `queries`, an **Enable notifications** control in `AppHeader`/`TenantLayout`, i18n.

- [ ] Migration: `push_subscriptions(id uuid pk, tenant_id uuid not null, user_id uuid not null, endpoint text unique not null, p256dh text, auth text, user_agent text, created_at timestamptz default now())`; enable RLS + `tenant_isolation` policy (`tenant_id = current_tenant_id()`); index on tenant_id. Update `docs/BUSINESS_LOGIC.md`.
- [ ] pgTAP `00NN_push_subscriptions_test.sql`: tenant isolation (insert/select scoped), unique endpoint.
- [ ] Generate VAPID keypair. `VITE_VAPID_PUBLIC_KEY` → `.env.local` + `.env.example`; `VAPID_PRIVATE_KEY` → local function env + (later) cloud secret. Store keys in gitignored creds file.
- [ ] `send-push` edge fn (Deno): input `{ tenant_id, type, title, body, url }`; service_role client; load tenant subs; send via a Deno web-push lib using VAPID; delete subs on 404/410. CORS via `_shared/cors.ts`. Deno tests for the classify/payload helper.
- [ ] Client: `subscribePush()` (permission → `pushManager.subscribe` → upsert via supabase), `unsubscribePush()`, support detection. **Enable notifications** toggle (header) — localized, RTL, ≥44px, graceful when unsupported.
- [ ] Event classification helper (pure, tested): given a `wash_orders` row change (old/new), return which notification(s) to send (queued / completed / done-unpaid). Used by the webhook receiver fn.
- [ ] Wire Supabase **Database Webhook** on `wash_orders` INSERT/UPDATE → `send-push` (or a `notify-wash-event` fn that classifies then calls send). (Webhook config is a cloud step — phase-6 task; locally test the fn directly.)
- [ ] Verify locally (subscribe flow, fn unit/Deno tests, pgTAP RLS) + build; gate → push `dev`.

## Phase 3 — Long-wait (>15 min) scheduler

- [ ] Migration: add `wash_orders.wait_notified_at timestamptz`. pgTAP unaffected-scope.
- [ ] A `check-long-waits` path: SQL function or edge fn that selects `waiting` washes with `created_at < now() - interval '15 min'` and `wait_notified_at is null`, sends push per tenant, stamps `wait_notified_at`. Pure threshold helper + test.
- [ ] `pg_cron` job (every minute) calling it (cloud step). Locally test the selection + stamping logic via pgTAP/SQL.
- [ ] Gate → push `dev`.

## Phase 4 — Realtime live queue

- [ ] Subscribe to `wash_orders` changes (Supabase Realtime) for the active branch in `useQueue`/queue page → invalidate or patch the query so the board + dashboard update live. Clean up the channel on unmount/branch change. Respect tenant via RLS-backed realtime.
- [ ] Verify live update across two sessions locally; build + tests; gate → push `dev`.

## Phase 5 (cloud) — wire env + verify e2e on staging

- [ ] Set `VITE_VAPID_PUBLIC_KEY` (Vercel) + `VAPID_PRIVATE_KEY` (supabase secret) on staging+prod; deploy `send-push`; enable Database Webhooks + `pg_cron`.
- [ ] e2e on staging: install PWA → enable notifications → create wash → receive push for each event.

## Notes
- RTL/responsive/i18n on every new UI (the enable-notifications control), checked LTR + AR.
- iOS web push requires installed PWA (16.4+); degrade gracefully elsewhere.
- Keep `autoUpdate` SW behavior so deploys don't strand users on stale bundles.
