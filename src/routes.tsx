import { createBrowserRouter, Navigate } from "react-router-dom"
import LoginPage from "./pages/LoginPage"
import NoAccessPage from "./pages/NoAccessPage"
import BusinessesPage from "./pages/admin/BusinessesPage"
import BranchesPage from "./pages/tenant/BranchesPage"
import PackagesPage from "./pages/tenant/PackagesPage"
import StaffPage from "./pages/tenant/StaffPage"
import CustomersPage from "./pages/tenant/CustomersPage"
import CustomerDetailPage from "./pages/tenant/CustomerDetailPage"
import QueuePage from "./pages/tenant/QueuePage"
import WashesPage from "./pages/tenant/WashesPage"
import WashDetailPage from "./pages/tenant/WashDetailPage"
import DashboardPage from "./pages/tenant/DashboardPage"
import AnalyticsPage from "./pages/tenant/AnalyticsPage"
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
                element: <Navigate to="/app/dashboard" replace />,
              },
              {
                path: "dashboard",
                element: <DashboardPage />,
              },
              {
                path: "analytics",
                element: <AnalyticsPage />,
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
              {
                path: "customers",
                element: <CustomersPage />,
              },
              {
                path: "customers/:id",
                element: <CustomerDetailPage />,
              },
              {
                path: "queue",
                element: <QueuePage />,
              },
              {
                path: "washes",
                element: <WashesPage />,
              },
              {
                path: "washes/:id",
                element: <WashDetailPage />,
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
