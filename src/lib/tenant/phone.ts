const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩"

/**
 * Convert Arabic-Indic digits to Western digits and strip spaces, dashes, and parentheses.
 */
export function normalizePhone(input: string): string {
  return [...(input ?? "")]
    .map((ch) => {
      const ai = ARABIC_INDIC.indexOf(ch)
      return ai >= 0 ? String(ai) : ch
    })
    .join("")
    .replace(/[\s\-()]/g, "")
}

/**
 * Sanitize a phone field value for real-time input:
 * 1. Convert Arabic-Indic digits (٠-٩) to Western digits.
 * 2. Strip every character that is not a digit (0-9).
 * 3. Truncate to a maximum of 11 characters.
 *
 * Safe to call on every keystroke / paste event. The result
 * contains only Western digit characters, at most 11 chars.
 */
export function sanitizePhoneInput(raw: string): string {
  return [...(raw ?? "")]
    .map((ch) => {
      const ai = ARABIC_INDIC.indexOf(ch)
      return ai >= 0 ? String(ai) : ch
    })
    .join("")
    .replace(/\D/g, "")
    .slice(0, 11)
}

/**
 * Return true if the normalized phone matches an Egyptian mobile number.
 * Valid prefixes: 010, 011, 012, 015. Total length: 11 digits.
 */
export function isValidEgyptianMobile(input: string): boolean {
  return /^01[0125]\d{8}$/.test(normalizePhone(input))
}

/**
 * Return the normalized digits-only form suitable for storage.
 * Strips spaces/dashes/parens and converts Arabic-Indic digits to Western.
 */
export function formatPhoneForStore(input: string): string {
  return normalizePhone(input)
}
