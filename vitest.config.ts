import path from "path"
import { defineConfig } from "vitest/config"

// Vitest runs only the app's unit tests under src/. The Supabase Edge Function
// tests are Deno (jsr: imports) and run via `deno test`, not Vitest. No Vite
// plugins are needed here because the current unit tests don't render components.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
})
