import React from "react"
import ReactDOM from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import "./i18n"
import { I18nDirection } from "./i18n/I18nDirection"
import { AuthProvider } from "@/auth/AuthProvider"
import { router } from "@/routes"
import { queryClient } from "@/lib/query"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nDirection>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </I18nDirection>
    </QueryClientProvider>
  </React.StrictMode>,
)
