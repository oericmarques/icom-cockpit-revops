import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "ICOM Cockpit - Dashboard Comercial",
  description: "Dashboard de performance comercial ICOM Marketing",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f0f2f5] antialiased">
        {children}
      </body>
    </html>
  )
}
