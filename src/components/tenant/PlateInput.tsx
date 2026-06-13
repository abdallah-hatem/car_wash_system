import { useRef } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { isArabicLetter, normalizePlateDigits, formatPlate } from "@/lib/tenant/plate"

export interface PlateValue { letters: string; digits: string }

export function PlateInput({ value, onChange }: { value: PlateValue; onChange: (v: PlateValue) => void }) {
  const { t, i18n } = useTranslation()
  const letters = [...(value.letters || "")]
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  function setLetter(idx: number, ch: string) {
    const last = ch.slice(-1)
    if (last && !isArabicLetter(last)) return
    const arr = [letters[0] ?? "", letters[1] ?? "", letters[2] ?? ""]
    arr[idx] = last ?? ""
    onChange({ ...value, letters: arr.join("") })
    if (last && idx < 2) refs[idx + 1].current?.focus()
  }

  return (
    <div className="space-y-2">
      <Label>{t("vehicles.plateLetters")}</Label>
      {/* Letter boxes in plate (RTL) order: rightmost = first letter under dir=rtl naturally */}
      <div className="flex gap-2" dir="rtl">
        {[0, 1, 2].map((idx) => (
          <Input
            key={idx}
            ref={refs[idx]}
            value={letters[idx] ?? ""}
            inputMode="text"
            maxLength={1}
            className="w-12 text-center min-h-[44px] text-lg"
            aria-label={`${t("vehicles.plateLetters")} ${idx + 1}`}
            onChange={(e) => setLetter(idx, e.target.value)}
          />
        ))}
      </div>
      <Label htmlFor="plate-digits">{t("vehicles.plateDigits")}</Label>
      <Input
        id="plate-digits"
        inputMode="numeric"
        value={value.digits}
        maxLength={4}
        className="max-w-[8rem] min-h-[44px] text-lg tracking-widest"
        onChange={(e) => onChange({ ...value, digits: normalizePlateDigits(e.target.value) })}
      />
      <p className="text-sm text-muted-foreground">
        {t("vehicles.platePreview")}: <span className="font-semibold">{formatPlate(value.letters, value.digits, i18n.resolvedLanguage ?? "en")}</span>
      </p>
    </div>
  )
}
