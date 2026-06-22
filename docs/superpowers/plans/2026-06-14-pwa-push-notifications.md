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

## Phase 2 — Web push core (3 DB-driven events) — DONE (local; cloud wiring pending)

**Files:** migration `0014_push_subscriptions.sql` (+ RLS), pgTAP `0017_push_subscriptions_test.sql`, `supabase/functions/notify-wash-event/` (`index.ts` + pure `classify.ts` + `classify.test.ts` + server-i18n `copy.ts`), `src/lib/notify/subscriptions.ts`, `src/components/tenant/NotificationsToggle.tsx` (in `TenantLayout`), i18n `notify.*` keys, `src/lib/database.types.ts` (new table type).

Implementation note: rather than a generic `send-push` fn taking `{ tenant_id, type, … }`, the receiver is a single **`notify-wash-event`** fn that takes the Database Webhook payload directly, classifies it (pure), refines `completed`→`done_unpaid` via a payments check, then loads subs and sends — simpler and fewer moving parts.

- [x] Migration `0014_push_subscriptions.sql`: `push_subscriptions(id, tenant_id default current_tenant_id(), user_id default auth.uid(), endpoint unique, p256dh, auth, lang default 'en', user_agent, created_at)`; RLS + `tenant_isolation`; index on tenant_id; grants to anon/authenticated (new tables no longer auto-exposed). `docs/BUSINESS_LOGIC.md` updated (§4, §6.10).
- [x] pgTAP `0017_push_subscriptions_test.sql` (4 assertions): tenant_id/user_id server defaults resolve, RLS isolation (A can't see B), unique endpoint (23505). Scoped by endpoint/tenant (no global counts).
- [x] VAPID keypair already provisioned: `VITE_VAPID_PUBLIC_KEY` in `.env.local`; `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` in gitignored `supabase/functions/.env`. No keys hardcoded.
- [x] `notify-wash-event` edge fn (Deno): receives `{ type, record, old_record }`; service_role client; payment check for `done_unpaid`; loads tenant subs; sends via `npm:web-push@^3` (`setVapidDetails`); deletes subs on 404/410; optional `WEBHOOK_SECRET` header guard; CORS via `_shared/cors.ts`; returns a JSON summary. Registered `verify_jwt = false` in `config.toml`.
- [x] Client `subscriptions.ts`: `pushSupported()`, `currentPushState()`, `enablePush(lang)` (permission → `pushManager.subscribe` → upsert by endpoint), `disablePush()`. **Enable notifications** bell in `TenantLayout` header — localized (`notify.*`), RTL logical utils, ≥44 px, graceful (disabled bell + hint) when unsupported/denied.
- [x] Pure classifier `classify.ts` + Deno test `classify.test.ts` (6 tests): queued on insert-waiting, null on insert-in_progress, completed on →done, null on unrelated update, null on already-done, plate/price extraction. Payment refinement (`done_unpaid`) lives in `index.ts`, not the pure classifier.
- [ ] **Cloud step (Phase 5):** create the Supabase **Database Webhook** on `public.wash_orders` INSERT + UPDATE → the deployed `notify-wash-event` URL (send `x-webhook-secret` if `WEBHOOK_SECRET` set). Locally the fn is tested directly.
- [x] Verified locally: `npm test` (68 Vitest incl. parity), `npm run build` clean, `npx supabase test db` (20 files / 61 tests incl. 0017), `deno test` classify (6/6). Gate → push `dev` (push is gated by the maintainer).

## Phase 3 — Long-wait (>15 min) scheduler

- [ ] Migration: add `wash_orders.wait_notified_at timestamptz`. pgTAP unaffected-scope.
- [ ] A `check-long-waits` path: SQL function or edge fn that selects `waiting` washes with `created_at < now() - interval '15 min'` and `wait_notified_at is null`, sends push per tenant, stamps `wait_notified_at`. Pure threshold helper + test.
- [ ] `pg_cron` job (every minute) calling it (cloud step). Locally test the selection + stamping logic via pgTAP/SQL.
- [ ] Gate → push `dev`.

## Phase 4 — Realtime live queue

- [ ] Subscribe to `wash_orders` changes (Supabase Realtime) for the active branch in `useQueue`/queue page → invalidate or patch the query so the board + dashboard update live. Clean up the channel on unmount/branch change. Respect tenant via RLS-backed realtime.
- [ ] Verify live update across two sessions locally; build + tests; gate → push `dev`.

## Phase 5 (cloud) — wire env + verify e2e on staging

- [ ] **Vercel:** set `VITE_VAPID_PUBLIC_KEY` (public key — public by design) on staging + prod.
- [ ] **Supabase function secrets** (`supabase secrets set`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:ops@…`), and optionally `WEBHOOK_SECRET`. (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.)
- [ ] **Deploy** the function: `npx supabase functions deploy notify-wash-event`.
- [ ] **Database Webhook:** on `public.wash_orders` for **INSERT + UPDATE** → POST the deployed `notify-wash-event` URL. If `WEBHOOK_SECRET` is set, add an `x-webhook-secret: <secret>` HTTP header to the webhook config.
- [ ] (Phase 3) enable `pg_cron` for the long-wait scanner.
- [ ] e2e on staging: install PWA → enable notifications → create wash → receive push for queued / completed / done-unpaid.

## Notes
- RTL/responsive/i18n on every new UI (the enable-notifications control), checked LTR + AR.
- iOS web push requires installed PWA (16.4+); degrade gracefully elsewhere.
- Keep `autoUpdate` SW behavior so deploys don't strand users on stale bundles.
