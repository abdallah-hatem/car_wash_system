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
