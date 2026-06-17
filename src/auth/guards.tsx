import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "./AuthProvider"
import { isOwner, canView, firstAccessiblePath, TAB_SEGMENTS, type TabKey } from "./claims"

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { claims, loading } = useAuth()
  if (loading) return null
  if (!claims.isPlatformAdmin)
    return <Navigate to={claims.tenantId ? "/app" : "/no-access"} replace />
  return <Outlet />
}

export function RequireTenant() {
  const { claims, loading } = useAuth()
  if (loading) return null
  if (!claims.tenantId)
    return <Navigate to={claims.isPlatformAdmin ? "/admin" : "/no-access"} replace />
  return <Outlet />
}

// Owner-only areas (Users, Branches management). Members are redirected to /app.
export function RequireOwner() {
  const { claims, loading } = useAuth()
  if (loading) return null
  if (!isOwner(claims)) return <Navigate to="/app" replace />
  return <Outlet />
}

// Per-tab access: derive the tab from the /app/<tab> path; a member without
// `view` on it is redirected to their first accessible tab. Non-tab segments
// (branches, users) pass through to their own guard (RequireOwner). This is a
// UX boundary; data is independently protected by RLS.
export function RequireTabAccess() {
  const { claims, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  const seg = location.pathname.split("/")[2] as TabKey | undefined
  if (seg && TAB_SEGMENTS.includes(seg) && !canView(claims, seg)) {
    return <Navigate to={firstAccessiblePath(claims)} replace />
  }
  return <Outlet />
}
