import { createBrowserRouter, Navigate } from "react-router-dom"
import LoginPage from "./pages/LoginPage"
import NoAccessPage from "./pages/NoAccessPage"
import { RequireAuth, RequireAdmin, RequireTenant } from "./auth/guards"

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/admin",
        element: <RequireAdmin />,
        children: [
          {
            index: true,
            element: <div className="p-6">Admin console (coming in Plan 2)</div>,
          },
        ],
      },
      {
        path: "/app",
        element: <RequireTenant />,
        children: [
          {
            index: true,
            element: <div className="p-6">Tenant app (coming in Plan 3)</div>,
          },
        ],
      },
      {
        path: "/no-access",
        element: <NoAccessPage />,
      },
      {
        path: "/",
        element: <Navigate to="/app" replace />,
      },
    ],
  },
])
