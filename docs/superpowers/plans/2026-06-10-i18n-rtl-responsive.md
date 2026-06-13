# Arabic / RTL + Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add Arabic + RTL support (auto-detect, fallback Arabic, per-device persistence) with a language switcher, translate the existing screens, and guarantee every screen is responsive on mobile + tablet in both LTR and RTL.

**Architecture:** `i18next`/`react-i18next` with browser language detection; locale JSON files; a pure `dirForLang` helper drives `<html dir/lang>`; physical Tailwind utilities converted to logical ones so layout mirrors; Cairo (self-hosted) for Arabic. A minimal `AppHeader` hosts the switcher for authenticated routes.

**Tech Stack:** React + Vite + TS, Tailwind v3 + shadcn, i18next, react-i18next, i18next-browser-languagedetector, @fontsource/cairo, Vitest.

**Existing context (already built):**
- `src/main.tsx` mounts `<AuthProvider><RouterProvider router={router}/></AuthProvider>` in StrictMode, imports `./index.css`.
- `src/routes.tsx` — createBrowserRouter: `/login`, and a `<RequireAuth/>` wrapper containing `/admin`→`<RequireAdmin/>`→placeholder, `/app`→`<RequireTenant/>`→placeholder, `/no-access`→`<NoAccessPage/>`, `/`→Navigate to `/app`.
- `src/pages/LoginPage.tsx` — split-canvas design, hardcoded English strings, uses `supabase.auth.signInWithPassword`.
- `src/pages/NoAccessPage.tsx` — "No workspace assigned" card with sign-out.
- `src/index.css` — Tailwind + shadcn HSL vars + `@import "@fontsource-variable/geist"` + login animations + `prefers-reduced-motion` block.

---

## File Structure
- Create: `src/i18n/index.ts`, `src/i18n/dir.ts`, `src/i18n/dir.test.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ar.json`, `src/i18n/locales.test.ts`
- Create: `src/components/LanguageSwitcher.tsx`, `src/components/AppHeader.tsx`
- Modify: `src/main.tsx`, `src/routes.tsx`, `src/pages/LoginPage.tsx`, `src/pages/NoAccessPage.tsx`, `src/index.css`

---

## Task 1: i18n infrastructure + dir helper (TDD)

**Files:** Create `src/i18n/dir.ts`, `src/i18n/dir.test.ts`, `src/i18n/index.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/ar.json`. Modify `package.json`.

- [ ] **Step 1: Install deps**
```bash
npm install i18next react-i18next i18next-browser-languagedetector @fontsource/cairo
```

- [ ] **Step 2: Write failing test** `src/i18n/dir.test.ts`
```ts
import { describe, it, expect } from "vitest"
import { dirForLang } from "./dir"

describe("dirForLang", () => {
  it("returns rtl for Arabic", () => {
    expect(dirForLang("ar")).toBe("rtl")
    expect(dirForLang("ar-EG")).toBe("rtl")
  })
  it("returns ltr for English and unknown", () => {
    expect(dirForLang("en")).toBe("ltr")
    expect(dirForLang("en-US")).toBe("ltr")
    expect(dirForLang("fr")).toBe("ltr")
    expect(dirForLang("")).toBe("ltr")
  })
})
```

- [ ] **Step 3: Run `npm test` — confirm FAIL** (cannot find `./dir`).

- [ ] **Step 4: Implement** `src/i18n/dir.ts`
```ts
export type Dir = "rtl" | "ltr"

/** Text direction for a BCP-47 language code. Arabic is RTL; everything else LTR. */
export function dirForLang(lng: string): Dir {
  return lng.toLowerCase().startsWith("ar") ? "rtl" : "ltr"
}
```

- [ ] **Step 5: Create locale files.** `src/i18n/locales/en.json`:
```json
{
  "common": {
    "appName": "Sudsly",
    "signOut": "Sign out",
    "language": "Language"
  },
  "auth": {
    "tagline": "The cleanest way to run your car wash.",
    "signInTitle": "Sign in",
    "email": "Email",
    "password": "Password",
    "signInButton": "Sign in",
    "signingIn": "Signing in…"
  },
  "noAccess": {
    "title": "No workspace assigned",
    "body": "Your account isn't linked to a business yet. Please contact your administrator."
  }
}
```
`src/i18n/locales/ar.json` (same keys, Arabic values):
```json
{
  "common": {
    "appName": "Sudsly",
    "signOut": "تسجيل الخروج",
    "language": "اللغة"
  },
  "auth": {
    "tagline": "أنظف طريقة لإدارة مغسلة سيارتك.",
    "signInTitle": "تسجيل الدخول",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "signInButton": "تسجيل الدخول",
    "signingIn": "جارٍ تسجيل الدخول…"
  },
  "noAccess": {
    "title": "لا توجد مساحة عمل مخصصة",
    "body": "حسابك غير مرتبط بأي نشاط تجاري بعد. يرجى التواصل مع المسؤول."
  }
}
```

- [ ] **Step 6: Implement** `src/i18n/index.ts`
```ts
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import en from "./locales/en.json"
import ar from "./locales/ar.json"

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, ar: { translation: ar } },
    supportedLngs: ["ar", "en"],
    fallbackLng: "ar",
    nonExplicitSupportedLngs: true, // ar-EG -> ar
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "lng",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
```

- [ ] **Step 7: Run `npm test` — confirm dir test PASSES.** Run `npm run build` — passes.

- [ ] **Step 8: Commit**
```bash
git add src/i18n package.json package-lock.json
git commit -m "feat(i18n): i18next setup, locales (en/ar), dir helper"
```

---

## Task 2: Wire i18n + direction into the app

**Files:** Modify `src/main.tsx`. Create `src/i18n/I18nDirection.tsx`.

- [ ] **Step 1: Create** `src/i18n/I18nDirection.tsx` — keeps `<html>` `lang`/`dir` synced to the active language.
```tsx
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
```

- [ ] **Step 2: Modify** `src/main.tsx` — import `./i18n` (side-effect init) BEFORE rendering and wrap the tree in `I18nDirection`.
```tsx
import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import "./i18n"
import { I18nDirection } from "./i18n/I18nDirection"
import { AuthProvider } from "@/auth/AuthProvider"
import { router } from "@/routes"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nDirection>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </I18nDirection>
  </React.StrictMode>,
)
```

- [ ] **Step 3: Verify** `npm run build` passes; `npm run dev` and confirm in the browser that `<html dir>` is `rtl` when the detected/stored language is Arabic. Commit.
```bash
git add src/main.tsx src/i18n/I18nDirection.tsx
git commit -m "feat(i18n): sync html lang/dir to active language"
```

---

## Task 3: LanguageSwitcher + Cairo font

**Files:** Create `src/components/LanguageSwitcher.tsx`. Modify `src/index.css`.

- [ ] **Step 1: Implement** `src/components/LanguageSwitcher.tsx` — compact, accessible toggle.
```tsx
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
```

- [ ] **Step 2: Apply Cairo for Arabic** — in `src/index.css`, add the import near the Geist import and a `lang`-scoped rule:
```css
@import "@fontsource/cairo/400.css";
@import "@fontsource/cairo/600.css";
@import "@fontsource/cairo/700.css";

html[lang="ar"] body {
  font-family: "Cairo", system-ui, sans-serif;
}
```
(Keep the existing Geist setup for the default/English case.)

- [ ] **Step 3: Verify** `npm run build` passes. Commit.
```bash
git add src/components/LanguageSwitcher.tsx src/index.css
git commit -m "feat(i18n): language switcher + Cairo Arabic font"
```

---

## Task 4: Translate + RTL-audit login and no-access; add AppHeader

**Files:** Modify `src/pages/LoginPage.tsx`, `src/pages/NoAccessPage.tsx`, `src/routes.tsx`. Create `src/components/AppHeader.tsx`.

- [ ] **Step 1: Translate `LoginPage.tsx`** — replace every hardcoded English string with `t("auth.…")`/`t("common.…")` using `const { t } = useTranslation()`. Add the `<LanguageSwitcher/>` in a corner of the form panel. Convert physical directional utilities to logical/`rtl:` so the layout mirrors: `pl-*→ps-*`, `pr-*→pe-*`, `ml-*→ms-*`, `mr-*→me-*`, `text-left→text-start`, `text-right→text-end`, absolute `left-*/right-*`→`start-*/end-*` (or add `rtl:` overrides for decorative absolutely-positioned elements). Confirm the split-canvas brand panel sits on the right under RTL.

- [ ] **Step 2: Translate `NoAccessPage.tsx`** — `t("noAccess.title")`, `t("noAccess.body")`, sign-out `t("common.signOut")`; logical utilities; include `<LanguageSwitcher/>` so a stuck user can still switch.

- [ ] **Step 3: Create `src/components/AppHeader.tsx`** — minimal authenticated header with the app name, `<LanguageSwitcher/>`, and a sign-out button; renders an `<Outlet/>` below. Responsive (compact on mobile). Uses logical utilities.
```tsx
import { Outlet, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"

export function AppHeader() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  async function signOut() {
    await supabase.auth.signOut()
    navigate("/login")
  }
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <span className="font-semibold">{t("common.appName")}</span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
            {t("common.signOut")}
          </Button>
        </div>
      </header>
      <main className="p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Wire `AppHeader` into routes** — in `src/routes.tsx`, wrap the `/app` and `/admin` (and `/no-access` stays as-is or also under header — keep `/no-access` standalone since the user has no workspace) authenticated placeholder routes so they render inside `<AppHeader/>`. Concretely, put `/app` and `/admin` as children of an `element: <AppHeader/>` layout route nested inside the existing `<RequireAuth/>` tree. Preserve the existing guard structure (`RequireAdmin`/`RequireTenant`) and the `/`→`/app` redirect.

- [ ] **Step 5: Verify** `npm run build` + `npm test` pass. Commit.
```bash
git add src/pages/LoginPage.tsx src/pages/NoAccessPage.tsx src/components/AppHeader.tsx src/routes.tsx
git commit -m "feat(i18n): translate + RTL-audit login/no-access, add app header"
```

---

## Task 5: Locale parity test + responsive/RTL verification

**Files:** Create `src/i18n/locales.test.ts`.

- [ ] **Step 1: Write the locale-parity test** `src/i18n/locales.test.ts`
```ts
import { describe, it, expect } from "vitest"
import en from "./locales/en.json"
import ar from "./locales/ar.json"

function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k
    return v && typeof v === "object"
      ? keyPaths(v as Record<string, unknown>, path)
      : [path]
  })
}

describe("locale parity", () => {
  it("en and ar have identical key sets", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(ar).sort())
  })
})
```

- [ ] **Step 2: Run `npm test` — confirm PASS** (parity holds; if it fails, a translation key is missing — fix the locale files).

- [ ] **Step 3: Responsive + RTL visual verification matrix.** Run the app (`npm run dev`) and, using a headless Chromium (the cached shell used previously), capture screenshots of `/login` and `/no-access` at **375px (mobile)** and **820px (tablet)** widths in BOTH `en` (LTR) and `ar` (RTL) — 8 shots. Verify: no horizontal overflow, brand panel/layout mirrors correctly in RTL, Arabic text uses Cairo, tap targets adequate, switcher reachable. Also load an authenticated placeholder route to confirm the `AppHeader` is responsive and mirrors. Note any breakage and fix before committing.

- [ ] **Step 4: Full local suite** — `npx supabase test db` (31 pass), `npm test` (all pass incl. dir + parity), `npm run build` (passes). Paste output.

- [ ] **Step 5: Commit**
```bash
git add src/i18n/locales.test.ts
git commit -m "test(i18n): locale parity test; responsive+RTL verification"
```

---

## Definition of Done
- Detected/stored Arabic renders the whole app RTL with mirrored layout and Cairo font; English renders LTR with Geist.
- Switcher on login + app header flips language live and persists across reload (localStorage `lng`).
- No hardcoded user-facing strings remain in login/no-access; `en`/`ar` locale key sets are identical (enforced by test).
- `/login` and `/no-access` verified at mobile + tablet in both LTR and RTL with no overflow.
- `dirForLang` + locale-parity unit tests pass; full local suite (pgTAP + Vitest + build) green.
- Standing responsive+RTL+i18n rule added to CLAUDE.md (separate step, outside this plan's commits).
