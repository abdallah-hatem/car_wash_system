import { useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"

export default function NoAccessPage() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate("/login")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-900/5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          No workspace assigned
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Your account isn't linked to a business yet. Please contact your
          administrator.
        </p>
        <button
          onClick={handleSignOut}
          className="mt-6 h-10 w-full rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-sm font-medium text-white shadow-lg shadow-teal-900/20 transition-transform hover:from-teal-600 hover:to-cyan-600 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
