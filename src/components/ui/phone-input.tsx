import * as React from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sanitizePhoneInput, isValidEgyptianMobile } from "@/lib/tenant/phone"

export interface PhoneInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Controlled value — must only contain Western digits (use sanitizePhoneInput). */
  value: string
  /** Called with the sanitized value (Arabic-Indic → Western, non-digits stripped, max 11 chars). */
  onChange: (value: string) => void
  /** Optional label rendered above the input. Accepts a string or React node (e.g. label + optional badge). */
  label?: React.ReactNode
  /** Explicit external error to show (e.g. from submit-time validation). Takes precedence over live validation. */
  error?: string
  /** HTML id forwarded to the <input>; also wires <Label htmlFor>. */
  id?: string
}

/**
 * A controlled phone input for Egyptian mobile numbers.
 *
 * - Strips non-digits and Arabic-Indic chars in real time via sanitizePhoneInput.
 * - Enforces maxLength={11} at the DOM level as a secondary guard.
 * - Shows an inline live error when the field is non-empty and invalid.
 * - The error only appears after the first interaction ("touched") to avoid
 *   flashing an error before the user has typed anything.
 * - Input content is always dir="ltr" (phone digits are LTR even under RTL);
 *   the wrapper / label layout uses logical Tailwind utilities (RTL-correct).
 */
export function PhoneInput({
  id,
  value,
  onChange,
  label,
  error: externalError,
  disabled,
  className,
  ...rest
}: PhoneInputProps) {
  const { t } = useTranslation()
  const [touched, setTouched] = React.useState(false)

  // Reset touched when the value is cleared externally (e.g. dialog reset on close).
  React.useEffect(() => {
    if (value === "") setTouched(false)
  }, [value])

  // Derive live inline error once the user has interacted with the field.
  // Empty value is always fine (field is optional in all call sites).
  const liveError =
    touched && value.length > 0 && !isValidEgyptianMobile(value)
      ? t("validation.phone_invalid")
      : null

  // External error (from submit-time validation) takes precedence.
  const displayError = externalError ?? liveError

  const hasError = Boolean(displayError)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const sanitized = sanitizePhoneInput(e.target.value)
    onChange(sanitized)
    // Mark touched on first keystroke so live errors become active.
    if (!touched) setTouched(true)
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setTouched(true)
    rest.onBlur?.(e)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={id}>{label}</Label>}
      <Input
        {...rest}
        id={id}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        // Numeric keyboard on mobile, but not `type="number"` (keeps leading zero).
        inputMode="numeric"
        autoComplete="tel"
        maxLength={11}
        // Phone digits are always LTR regardless of page direction.
        dir="ltr"
        aria-invalid={hasError || undefined}
        aria-describedby={hasError && id ? `${id}-error` : undefined}
        className={cn(
          "min-h-[44px]",
          hasError && "border-destructive focus-visible:ring-destructive",
          className
        )}
      />
      {hasError && (
        <p
          id={id ? `${id}-error` : undefined}
          role="alert"
          className="text-xs text-destructive"
        >
          {displayError}
        </p>
      )}
    </div>
  )
}
