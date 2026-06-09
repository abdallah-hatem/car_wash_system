import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"

export default function NoAccessPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate("/login")
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="absolute end-4 top-4">
        <LanguageSwitcher />
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-900/5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {t("noAccess.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{t("noAccess.body")}</p>
        <button
          onClick={handleSignOut}
          className="mt-6 h-10 w-full rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-sm font-medium text-white shadow-lg shadow-teal-900/20 transition-transform hover:from-teal-600 hover:to-cyan-600 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          {t("common.signOut")}
        </button>
      </div>
    </div>
  )
}
