/** Normalize a plate for display/search: trim ends, collapse inner whitespace, uppercase. */
export function normalizePlate(s: string): string {
  return s.trim().replace(/\s+/g, " ").toUpperCase()
}

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩"

/** Convert Arabic-Indic digits to Western digits and strip non-digit characters. */
export function normalizePlateDigits(s: string): string {
  return [...(s ?? "")]
    .map((ch) => {
      const ai = ARABIC_INDIC.indexOf(ch)
      return ai >= 0 ? String(ai) : ch
    })
    .join("")
    .replace(/[^0-9]/g, "")
}

/** Returns true if ch is a single Arabic letter (Unicode range ء–ي, excluding tatweel ـ U+0640). */
export function isArabicLetter(ch: string): boolean {
  return /^[ء-ي]$/.test(ch) && ch !== "ـ"
}

/** Strip spaces and tatweel (ـ), keep only Arabic letters. */
export function normalizePlateLetters(s: string): string {
  return [...(s ?? "")].filter((ch) => isArabicLetter(ch)).join("")
}

/** Produce the canonical stored plate string: normalized letters + space + western digits. */
export function canonicalPlate(letters: string, digits: string): string {
  return `${normalizePlateLetters(letters)} ${normalizePlateDigits(digits)}`
}

/** Normalize a search term for plate matching: convert Arabic-Indic digits to Western, trim. */
export function normalizePlateSearch(term: string): string {
  return [...(term ?? "").trim()]
    .map((ch) => {
      const ai = ARABIC_INDIC.indexOf(ch)
      return ai >= 0 ? String(ai) : ch
    })
    .join("")
}

/** Format a plate for display: spaced letters + spaced double-space + locale-appropriate digits. */
export function formatPlate(letters: string, digits: string, locale: string): string {
  const L = normalizePlateLetters(letters).split("").join(" ")
  let D = normalizePlateDigits(digits)
  if (locale.startsWith("ar")) {
    D = D.split("").map((d) => ARABIC_INDIC[Number(d)] ?? d).join("")
  }
  return `${L}  ${D}`.trim()
}
