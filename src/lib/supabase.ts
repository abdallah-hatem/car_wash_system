import { createClient } from "@supabase/supabase-js"
import type { Database } from "./database.types"

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")
}

// When a data/functions request comes back 401, the session is no longer valid
// (e.g. the refresh token was revoked/expired). The auth layer registers a handler
// here so the app can sign out and redirect to /login instead of surfacing a
// cryptic "something went wrong" on every action.
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

const authAwareFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)
  if (res.status === 401) {
    const u =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    if (u.includes("/rest/") || u.includes("/functions/")) onUnauthorized?.()
  }
  return res
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: { fetch: authAwareFetch },
})
