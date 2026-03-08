"use client"

import { PrivyProvider } from "@privy-io/react-auth"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { baseSepolia } from "viem/chains"

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_ID

if (!PRIVY_APP_ID) {
  throw new Error("NEXT_PUBLIC_PRIVY_ID environment variable is required")
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#f59e0b",
          logo: "/logo-icon.png",
        },
        loginMethods: ["email", "wallet", "google"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: baseSepolia,
        supportedChains: [baseSepolia],
      }}
    >
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </PrivyProvider>
  )
}
