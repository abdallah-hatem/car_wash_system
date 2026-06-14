/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/info" />

import { clientsClaim } from "workbox-core"
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"

declare const self: ServiceWorkerGlobalScope

// ─── Precaching ────────────────────────────────────────────────────────────
// __WB_MANIFEST is injected by vite-plugin-pwa / workbox-build at build time.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ─── App-shell navigation fallback (offline) ──────────────────────────────
// Any navigation request that isn't already precached falls back to the
// cached index.html so the SPA shell loads even when offline.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html")),
)

// ─── Controlled update via SKIP_WAITING message ────────────────────────────
// The app sends { type: 'SKIP_WAITING' } from the update banner, triggering
// the waiting SW to activate without a full page refresh loop.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    void self.skipWaiting()
  }
})

// clientsClaim() makes the newly activated SW take control of all open clients
// immediately so the fresh assets are served right away.
clientsClaim()

// ─── Push notifications (Phase 2 wiring — handlers are ready now) ─────────

interface PushPayload {
  title?: string
  body?: string
  url?: string
  tag?: string
}

self.addEventListener("push", (event) => {
  let data: PushPayload = {}
  try {
    data = (event.data?.json() as PushPayload) ?? {}
  } catch {
    data = {}
  }

  const title = data.title ?? "WashFlow"
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: "/pwa-192.png",
    badge: "/pwa-192.png",
    data: { url: data.url ?? "/app/queue" },
    tag: data.tag,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl: string =
    (event.notification.data as { url?: string } | null)?.url ?? "/app/queue"

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus an existing window/tab that already has the target URL open.
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return (client as WindowClient).focus()
          }
        }
        // Otherwise open a new window.
        return self.clients.openWindow(targetUrl)
      }),
  )
})
