import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const next = i18n.resolvedLanguage === "ar" ? "en" : "ar"
  const label = i18n.resolvedLanguage === "ar" ? "EN" : "ع"
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      aria-label={t("common.language")}
      onClick={() => void i18n.changeLanguage(next)}
    >
      {label}
    </Button>
  )
}
