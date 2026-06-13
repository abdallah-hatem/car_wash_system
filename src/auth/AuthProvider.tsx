import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session } from "@supabase/supabase-js"
import { supabase, setUnauthorizedHandler } from "@/lib/supabase"
import { decodeClaims, type AppClaims } from "./claims"

interface AuthState {
  session: Session | null
  claims: AppClaims
  loading: boolean
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))

    // If a data/functions request 401s (revoked/expired session), sign out so the
    // guards redirect to /login — avoids leaving a half-dead session that errors on
    // every write. signOut clears local state even if the server call fails.
    setUnauthorizedHandler(() => {
      void supabase.auth.signOut().finally(() => setSession(null))
    })

    return () => {
      sub.subscription.unsubscribe()
      setUnauthorizedHandler(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ session, claims: decodeClaims(session), loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
