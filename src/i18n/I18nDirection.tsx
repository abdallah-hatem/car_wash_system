import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { dirForLang } from "./dir"

export function I18nDirection({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()
  useEffect(() => {
    const apply = (lng: string) => {
      document.documentElement.lang = lng
      document.documentElement.dir = dirForLang(lng)
    }
    apply(i18n.resolvedLanguage ?? i18n.language)
    i18n.on("languageChanged", apply)
    return () => i18n.off("languageChanged", apply)
  }, [i18n])
  return <>{children}</>
}
