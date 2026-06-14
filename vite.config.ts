import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use injectManifest so we control the SW fully (push handlers, etc.)
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      // Prompt-based registration so we can show a controlled "reload" banner
      // instead of auto-refreshing mid-action (avoids stranding users on stale bundles).
      registerType: "prompt",
      // We call registerSW() manually from src/pwa.ts so the plugin does not
      // auto-inject a registration snippet.
      injectRegister: null,
      // Tell the plugin where the injectManifest globs should be resolved from.
      injectManifest: {
        globDirectory: "dist",
        globPatterns: ["**/*.{js,css,html,ico,svg,png,woff2}"],
      },
      manifest: {
        name: "WashFlow",
        short_name: "WashFlow",
        description: "Car wash operations, run beautifully.",
        theme_color: "#0d9488",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    // Always resolve a single React copy. The Deno-based test runs (deno test /
    // supabase functions) can create a stray node_modules/.deno/react, and without
    // dedupe Vite may pre-bundle two React instances → hooks crash ("Cannot read …
    // null") when components like the queue dialogs render. dedupe pins one copy.
    dedupe: ["react", "react-dom"],
  },
})
