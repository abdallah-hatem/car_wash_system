import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const linkBase = "block rounded-md px-3 py-2 text-sm font-medium min-h-[44px] flex items-center"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const items = [
    { to: "/app/dashboard", label: t("nav.dashboard") },
    { to: "/app/queue", label: t("nav.queue") },
    { to: "/app/customers", label: t("nav.customers") },
    { to: "/app/branches", label: t("nav.branches") },
    { to: "/app/packages", label: t("nav.packages") },
    { to: "/app/staff", label: t("nav.staff") },
  ]
  return (
    <nav className="space-y-1">
      {items.map((it) => (
        <NavLink key={it.to} to={it.to} onClick={onNavigate}
          className={({ isActive }) => cn(linkBase, isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
          {it.label}
        </NavLink>
      ))}
    </nav>
  )
}
