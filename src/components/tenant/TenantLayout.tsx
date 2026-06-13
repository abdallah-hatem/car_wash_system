import { useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { SidebarNav } from "./SidebarNav"
import { BranchSelector } from "./BranchSelector"
import { BranchProvider } from "@/lib/tenant/branch-context"
import { Menu } from "lucide-react"

function TenantLayoutInner() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)
  async function signOut() { await supabase.auth.signOut(); navigate("/login") }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" className="lg:hidden min-h-[44px]"
            aria-label={t("nav.menu")} onClick={() => setDrawerOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold">{t("common.appName")}</span>
        </div>
        <div className="flex items-center gap-1 min-w-0 overflow-hidden">
          <BranchSelector />
          <LanguageSwitcher />
          <Button type="button" variant="ghost" size="sm" className="min-h-[44px] shrink-0" onClick={() => void signOut()}>
            {t("common.signOut")}
          </Button>
        </div>
      </header>

      <div className="lg:grid lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block border-e p-3">
          <SidebarNav />
        </aside>

        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 start-0 w-64 bg-background p-3 shadow-lg">
              <SidebarNav onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        )}

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function TenantLayout() {
  return (
    <BranchProvider>
      <TenantLayoutInner />
    </BranchProvider>
  )
}
