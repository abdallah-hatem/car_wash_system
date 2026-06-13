import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    // Always resolve a single React copy. The Deno-based test runs (deno test /
    // supabase functions) can create a stray node_modules/.deno/react, and without
    // dedupe Vite may pre-bundle two React instances → hooks crash ("Cannot read …
    // null") when components like the queue dialogs render. dedupe pins one copy.
    dedupe: ["react", "react-dom"],
  },
})
