import { createBrowserRouter, Navigate } from "react-router-dom"
import LoginPage from "./pages/LoginPage"
import NoAccessPage from "./pages/NoAccessPage"
import BusinessesPage from "./pages/admin/BusinessesPage"
import BranchesPage from "./pages/tenant/BranchesPage"
import PackagesPage from "./pages/tenant/PackagesPage"
import StaffPage from "./pages/tenant/StaffPage"
import { AppHeader } from "./components/AppHeader"
import { TenantLayout } from "./components/tenant/TenantLayout"
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
        element: <AppHeader />,
        children: [
          {
            path: "/admin",
            element: <RequireAdmin />,
            children: [
              {
                index: true,
                element: <BusinessesPage />,
              },
            ],
          },
        ],
      },
      {
        path: "/app",
        element: <RequireTenant />,
        children: [
          {
            element: <TenantLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/app/branches" replace />,
              },
              {
                path: "branches",
                element: <BranchesPage />,
              },
              {
                path: "packages",
                element: <PackagesPage />,
              },
              {
                path: "staff",
                element: <StaffPage />,
              },
            ],
          },
        ],
      },
      {
        path: "/",
        element: <Navigate to="/app" replace />,
      },
      {
        path: "/no-access",
        element: <NoAccessPage />,
      },
    ],
  },
])
