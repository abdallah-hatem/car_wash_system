# PWA + Web Push Notifications — Design

**Goal:** Make WashFlow an installable PWA and deliver **web push notifications** (alerts even
when the app is closed/backgrounded) for four wash-lifecycle events, plus realtime live-queue
updates so the on-screen operator also sees changes.

**Status:** Approved 2026-06-14. Built in phases; each phase is independently shippable.

## Events to notify on (per tenant)
1. **New wash queued** — `wash_orders` INSERT (status `waiting`).
2. **Wash completed** — `wash_orders` UPDATE → status `done`.
3. **Wash done & awaiting payment** — on the `done` transition, when paid < price.
4. **Long wait (>15 min)** — a `waiting` wash older than 15 min (time-based; no DB event).

## Architecture (web push pipeline)
```
Operator device                                  Supabase
1. PWA installed → service worker          push_subscriptions (tenant-scoped, RLS)
2. Enable notifications → Notification           ▲ upsert sub (endpoint + keys)
   permission → pushManager.subscribe(VAPIDpub)──┘
                                            wash_orders INSERT/UPDATE
                                                  │ Database Webhook
                                                  ▼
   SW 'push' → showNotification    ◄── web-push ── send-push edge fn (VAPID private)
   SW 'notificationclick' → open /app/queue        loads tenant subs, sends
```

## Components
- **PWA foundation** — `vite-plugin-pwa` with `injectManifest` (hand-written SW so we control
  push handling). Web manifest: name "WashFlow", `display: standalone`, teal `theme_color`,
  maskable 192/512 icons. SW precaches the app shell (Workbox), `registerType: autoUpdate` +
  skip-waiting so we never serve a stale bundle. SW handles `push` (showNotification) and
  `notificationclick` (focus/open `/app/queue`).
- **Data model** — `push_subscriptions(id, tenant_id, user_id, endpoint unique, p256dh, auth,
  user_agent, created_at)`. `tenant_id` + `tenant_isolation` RLS + isolation pgTAP test. A
  dedup marker for long-wait: `wash_orders.wait_notified_at timestamptz` (set once notified).
- **`send-push` edge function** — input `{ tenant_id, type, title, body, url }`; loads that
  tenant's subscriptions; sends via the Web Push protocol using the VAPID keypair; prunes
  `410 Gone` / `404` subscriptions. Uses the `service_role` (server-side) to read subs.
- **Triggers** — Supabase **Database Webhook** on `wash_orders` INSERT + UPDATE → calls
  `send-push` with the right event type (or a thin `notify-wash-event` fn that classifies the
  row change, then sends). Long-wait → `pg_cron` (every minute) scans `waiting` washes with
  `created_at < now()-15min` and `wait_notified_at is null`, sends, stamps `wait_notified_at`.
- **Client** — an **Enable notifications** toggle (in the app header or settings): requests
  Notification permission, subscribes via `pushManager.subscribe({ applicationServerKey:
  VITE_VAPID_PUBLIC_KEY })`, upserts the subscription; supports unsubscribe. Localized (en/ar),
  RTL, ≥44px. Per device. Graceful when unsupported (older iOS / not installed).
- **Realtime live queue (recommended layer)** — Supabase Realtime subscription on
  `wash_orders` for the active branch → invalidate/patch the queue + dashboard so the open
  tablet updates without a manual refresh (also covers the focused-tab case where push is
  suppressed). Delivers the long-deferred live board.

## Security
- VAPID **private key** lives only as an edge-function secret (`VAPID_PRIVATE_KEY`); the
  **public key** ships to the client (`VITE_VAPID_PUBLIC_KEY`) — public by design.
- `push_subscriptions` is tenant-isolated by RLS; the send function reads via `service_role`
  server-side only. Never expose `service_role` to the client.
- A user only ever receives their own tenant's events.

## External setup (per environment: local / staging / prod)
- Generate a VAPID keypair; set `VITE_VAPID_PUBLIC_KEY` (client env / Vercel) +
  `VAPID_PRIVATE_KEY` (Supabase function secret).
- Enable **Database Webhooks** on `wash_orders`; enable **`pg_cron`** for long-wait.
- **iOS:** web push requires the PWA **installed to the home screen**, iOS 16.4+. Android &
  desktop work in-browser. The UI degrades gracefully where push is unavailable.

## Testing
- Local: PWA installability, the subscribe/permission flow, and the SW `push`/`click` handlers
  (via DevTools simulated push) + pure helpers (event classification, VAPID-key encoding) unit-
  tested; `push_subscriptions` RLS via pgTAP.
- Full end-to-end push (webhook → send-push → device) is verified on **staging** (needs the
  cloud function + VAPID + webhooks).

## Phasing
1. **PWA** — installable + SW + handlers (no push yet).
2. **Web push core** — subscriptions + `send-push` + the 3 DB-driven events + enable UI + VAPID.
3. **Long-wait** — `pg_cron` scheduler + `wait_notified_at` dedup.
4. **Realtime live queue** — open-tablet live updates.

## Out of scope
Full offline *data* sync; SMS/email notifications; per-user notification preferences/quiet hours
(could be a later enhancement).
