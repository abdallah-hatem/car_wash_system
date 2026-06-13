export type Dir = "rtl" | "ltr"
/** Text direction for a BCP-47 language code. Arabic is RTL; everything else LTR. */
export function dirForLang(lng: string): Dir {
  return lng.toLowerCase().startsWith("ar") ? "rtl" : "ltr"
}
