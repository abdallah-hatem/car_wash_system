import { Outlet, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"

export function AppHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  async function signOut() {
    await supabase.auth.signOut()
    navigate("/login")
  }
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <span className="font-semibold">{t("common.appName")}</span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
            {t("common.signOut")}
          </Button>
        </div>
      </header>
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
