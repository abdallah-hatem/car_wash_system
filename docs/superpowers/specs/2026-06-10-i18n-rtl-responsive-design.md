# Arabic / RTL Internationalization + Responsiveness — Design

**Date:** 2026-06-10
**Status:** Approved
**Pulls forward:** the "Arabic/RTL" item deferred from the foundation spec.

## 1. Purpose

Make the carwash SaaS fully usable in Arabic with correct right-to-left layout, and
guarantee every screen works on mobile and tablet in both text directions. The app is a
tablet-first PWA, so responsive + RTL correctness are acceptance criteria, not polish.

## 2. Locked decisions

- **Default language:** auto-detect. Browser `ar*` → Arabic; `en*` → English; anything
  else → Arabic (fallback). Persisted per-device in `localStorage` (key `lng`).
- **Switcher placement:** on the login screen AND in a minimal in-app header.
- **Persistence:** per-device (localStorage). No DB/schema change.
- **Arabic font:** Cairo, self-hosted via `@fontsource` (no CDN; PWA/offline-friendly,
  matches the existing self-hosted Geist approach). Geist stays for English.
- **Scope:** infra + translate the two existing screens (login, no-access) + add the
  switcher and a minimal app header. No new app/admin feature pages (still placeholders).

## 3. Architecture

- **`src/i18n/index.ts`** — initialize `i18next` + `react-i18next` +
  `i18next-browser-languagedetector`. `supportedLngs: ['ar','en']`, `fallbackLng: 'ar'`,
  detection order `['localStorage','navigator']`, cache `['localStorage']`. Imported once
  from `main.tsx` before render.
- **`src/i18n/locales/en.json`, `ar.json`** — translations namespaced by area
  (`auth`, `common`). Identical key sets across both files.
- **`src/i18n/dir.ts`** — pure helper `dirForLang(lng: string): 'rtl' | 'ltr'`
  (`'ar'` → `'rtl'`, else `'ltr'`).
- **Direction application** — on language change, set
  `document.documentElement.lang` and `.dir`. Implemented as a small effect mounted high
  in the tree (in `main.tsx` wrapper or an `I18nDirection` component).
- **`src/components/LanguageSwitcher.tsx`** — compact `EN / ع` control calling
  `i18n.changeLanguage(next)`. Accessible (button with `aria-label`, `aria-pressed` or
  a labelled toggle). Used on login + app header.
- **`src/components/AppHeader.tsx`** — minimal authenticated header bar hosting the
  `LanguageSwitcher` and a sign-out button; wraps the `/app` and `/admin` placeholder
  routes via a layout route. This is where Plans 2/3 will add real navigation.

## 4. RTL styling audit

- Convert physical directional utilities in the login + no-access screens to logical
  equivalents or `rtl:`/`ltr:` variants: `pl-/pr-`→`ps-/pe-`, `ml-/mr-`→`ms-/me-`,
  `text-left/right`→`text-start/end`, `left-/right-`→`start-/end-` (or `rtl:` overrides
  for absolutely-positioned decorative elements).
- The login split-canvas grid mirrors automatically under `dir="rtl"` (grid inline axis
  reverses); verify the brand panel moves to the right and decorative glow/droplets still
  sit correctly.
- Font application: `html[lang="ar"]` selector applies the Cairo family; `lang="en"`
  keeps Geist.

## 5. Responsiveness (acceptance criterion)

- All screens + new components must render cleanly at **mobile (~375px)** and
  **tablet (~768–1024px)**: no horizontal overflow, tap targets ≥ 44px, readable type.
- **Verified in BOTH directions** (LTR/English and RTL/Arabic): a 2 widths × 2 directions
  matrix per screen (4 checks each for login + no-access; header verified in-context).
- Verification via headless-Chromium screenshots at the two widths in `ar` and `en`.

## 6. Testing

- **Unit (Vitest):**
  - `dirForLang`: `'ar'`/`'ar-EG'`→`'rtl'`, `'en'`/`'en-US'`/unknown→`'ltr'`.
  - **Locale parity:** deep key sets of `en.json` and `ar.json` are identical (fails if a
    translation is missing in either file).
- **Manual/visual:** Arabic renders RTL with mirrored layout + Cairo font; toggling the
  switcher flips direction live and persists across reload; responsive matrix passes.
- Full local suite (pgTAP + Vitest + build) green before pushing to `dev`.

## 7. Out of scope

Per-user/server-side language persistence (deferred — would need a profile column);
translating future Plan 2/3 pages (they'll add their own keys to the same locale files);
additional languages beyond ar/en.

## 8. Standing rule

Record in CLAUDE.md: every screen must be responsive (tablet-first) and verified in both
LTR and RTL, and all user-facing strings must come from the i18n locale files (no
hardcoded text) with `en`/`ar` parity.
