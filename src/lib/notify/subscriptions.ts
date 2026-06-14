// Client-side web-push subscription management.
//
// The browser subscribes via the service worker's PushManager using the VAPID
// public key, then upserts the subscription into public.push_subscriptions
// through the anon Supabase client. tenant_id/user_id are filled by DB column
// DEFAULTs (current_tenant_id()/auth.uid()) — the client only ever sends the
// push fields, so it can't spoof another tenant (RLS also enforces this).

import { supabase } from "@/lib/supabase"
import { urlBase64ToUint8Array } from "./push"

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState =
  | "unsupported"
  | "denied"
  | "unsubscribed"
  | "subscribed"

/** True when this browser supports the full web-push stack. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

/** Current push state for this device (permission + active subscription). */
export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported"
  if (Notification.permission === "denied") return "denied"

  const reg = await navigator.serviceWorker.getRegistration()
  const existing = await reg?.pushManager.getSubscription()
  if (existing && Notification.permission === "granted") return "subscribed"
  return "unsubscribed"
}

/** Extract the base64url-encoded p256dh/auth keys from a PushSubscription. */
function readKeys(sub: PushSubscription): { p256dh: string; auth: string } {
  const p256dh = sub.getKey("p256dh")
  const auth = sub.getKey("auth")
  if (!p256dh || !auth) throw new Error("subscription missing keys")
  const b64 = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")
  return { p256dh: b64(p256dh), auth: b64(auth) }
}

/**
 * Request notification permission, subscribe via the SW PushManager, and
 * upsert the subscription (keyed on endpoint) into push_subscriptions.
 */
export async function enablePush(lang: string): Promise<void> {
  if (!pushSupported()) throw new Error("push_unsupported")
  if (!VAPID_PUBLIC_KEY) throw new Error("missing_vapid_public_key")

  const permission = await Notification.requestPermission()
  if (permission !== "granted") throw new Error("permission_denied")

  const reg = await navigator.serviceWorker.ready

  // Reuse an existing subscription if present, otherwise create one.
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    // urlBase64ToUint8Array always allocates a fresh (non-shared) ArrayBuffer,
    // so it's a valid BufferSource; the cast satisfies the lib.dom typing that
    // can't statically rule out SharedArrayBuffer.
    const applicationServerKey = urlBase64ToUint8Array(
      VAPID_PUBLIC_KEY,
    ) as unknown as BufferSource
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  }

  const { p256dh, auth } = readKeys(sub)

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      p256dh,
      auth,
      lang: lang === "ar" ? "ar" : "en",
      user_agent: navigator.userAgent,
    },
    { onConflict: "endpoint" },
  )
  if (error) throw error
}

/** Unsubscribe this device and delete its row from push_subscriptions. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return

  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return

  const endpoint = sub.endpoint
  await sub.unsubscribe()

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
  if (error) throw error
}
