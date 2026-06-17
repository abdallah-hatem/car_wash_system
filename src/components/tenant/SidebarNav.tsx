import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { BarChart3, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/auth/AuthProvider"
import { canView, isOwner, type TabKey } from "@/auth/claims"

const linkBase = "block rounded-md px-3 py-2 text-sm font-medium min-h-[44px] flex items-center gap-2.5"

type NavItem = { to: string; label: string; icon?: LucideIcon; tab?: TabKey; ownerOnly?: boolean }

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { claims } = useAuth()

  const items: NavItem[] = [
    { to: "/app/dashboard", label: t("nav.dashboard"), tab: "dashboard" },
    { to: "/app/analytics", label: t("nav.analytics"), icon: BarChart3, tab: "analytics" },
    { to: "/app/queue", label: t("nav.queue"), tab: "queue" },
    { to: "/app/washes", label: t("nav.washes"), tab: "washes" },
    { to: "/app/customers", label: t("nav.customers"), tab: "customers" },
    { to: "/app/branches", label: t("nav.branches"), ownerOnly: true },
    { to: "/app/packages", label: t("nav.packages"), tab: "packages" },
    { to: "/app/staff", label: t("nav.staff"), tab: "staff" },
    { to: "/app/users", label: t("nav.users"), icon: Users, ownerOnly: true },
  ]

  // Owner sees everything; a member sees owner-only items never and tab items
  // only where they have at least `view`.
  const visible = items.filter((it) =>
    it.ownerOnly ? isOwner(claims) : it.tab ? canView(claims, it.tab) : true,
  )

  return (
    <nav className="space-y-1">
      {visible.map((it) => {
        const Icon = it.icon
        return (
          <NavLink key={it.to} to={it.to} onClick={onNavigate}
            className={({ isActive }) => cn(linkBase, isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
            {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
            {it.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
