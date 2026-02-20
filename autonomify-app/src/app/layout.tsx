import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Space_Mono } from "next/font/google"
import "./globals.css"
import { WalletProvider } from "@/lib/wallet"

const inter = Inter({ subsets: ["latin"] })

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space",
})

export const metadata: Metadata = {
  title: "Autonomify",
  description: "Turn any verified contract into a Telegram agent",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${jetbrainsMono.variable} ${spaceMono.variable}`}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  )
}
