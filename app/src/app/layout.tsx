import type { Metadata } from "next"
import { Inter, JetBrains_Mono, Space_Mono } from "next/font/google"
import "./globals.css"
import { WalletProvider } from "@/lib/wallet"
import { NetworkProvider } from "@/contexts/network-context"

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
  description: "On-demand AI Agents - Turn any smart contract into and autonomous agent on Chainlink runtime Environment (CRE)",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${jetbrainsMono.variable} ${spaceMono.variable}`} suppressHydrationWarning>
        <NetworkProvider defaultMode="testnet">
          <WalletProvider>{children}</WalletProvider>
        </NetworkProvider>
      </body>
    </html>
  )
}
