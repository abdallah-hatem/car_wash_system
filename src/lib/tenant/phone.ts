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
