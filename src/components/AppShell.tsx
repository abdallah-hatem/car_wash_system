/**
 * AppShell — thin wrapper that owns PWA update banner state.
 *
 * Kept separate from main.tsx so the banner can access the i18n context
 * (the I18nDirection provider is above us in the tree).
 */
import type { ReactNode } from "react"
import { PwaUpdateBanner } from "@/components/PwaUpdateBanner"
import { usePwaUpdate } from "@/hooks/usePwaUpdate"

interface Props {
  children: ReactNode
}

export function AppShell({ children }: Props) {
  const { showBanner, reload, dismiss } = usePwaUpdate()

  return (
    <>
      {showBanner && (
        <PwaUpdateBanner onReload={reload} onDismiss={dismiss} />
      )}
      {children}
    </>
  )
}
