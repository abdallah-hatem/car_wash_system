import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "./AuthProvider"
import { isOwner } from "./claims"

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
