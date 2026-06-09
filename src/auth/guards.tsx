import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "./AuthProvider"

export function RequireAuth() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

export function RequireAdmin() {
  const { claims, loading } = useAuth()
  if (loading) return null
  if (!claims.isPlatformAdmin) return <Navigate to="/app" replace />
  return <Outlet />
}

export function RequireTenant() {
  const { claims, loading } = useAuth()
  if (loading) return null
  if (!claims.tenantId) return <Navigate to="/admin" replace />
  return <Outlet />
}
