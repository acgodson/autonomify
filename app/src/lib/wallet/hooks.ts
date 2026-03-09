"use client"

import { usePrivy, useWallets } from "@privy-io/react-auth"
import { useCallback, useEffect, useState } from "react"
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  type Address,
} from "viem"
import { baseSepolia } from "viem/chains"
import {
  toMetaMaskSmartAccount,
  Implementation,
  type MetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit"

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const

export interface TokenBalance {
  address: string
  symbol: string
  balance: string
  rawBalance: bigint
  decimals: number
}

export function useWallet() {
  const { ready: privyReady, authenticated, login, logout, user } = usePrivy()
  const { wallets, ready: walletsReady } = useWallets()

  const [smartAccount, setSmartAccount] = useState<MetaMaskSmartAccount<any> | null>(null)
  const [smartAccountAddress, setSmartAccountAddress] = useState<string | null>(null)
  const [isSmartAccountLoading, setIsSmartAccountLoading] = useState(false)
  const [isAccountReady, setIsAccountReady] = useState(false)
  const [showAccountSetup, setShowAccountSetup] = useState(false)

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy")

  // Log all wallets to debug
  useEffect(() => {
    if (wallets.length > 0) {
      console.log("[useWallet] Available wallets (FULL):", wallets.map(w => ({
        type: w.walletClientType,
        connectorType: (w as any).connectorType,
        walletClient: (w as any).walletClient,
        address: w.address,
      })))
      console.log("[useWallet] Looking for 'privy' wallet, found:", embeddedWallet ? embeddedWallet.address : "NOT FOUND")
    }
  }, [wallets, embeddedWallet])

  // Debug logging
  useEffect(() => {
    console.log("[useWallet] State:", {
      privyReady,
      walletsReady,
      authenticated,
      walletsCount: wallets.length,
      walletTypes: wallets.map(w => w.walletClientType),
      embeddedWallet: embeddedWallet?.address,
      smartAccountAddress,
      isSmartAccountLoading,
    })
  }, [privyReady, walletsReady, authenticated, wallets, embeddedWallet, smartAccountAddress, isSmartAccountLoading])

  useEffect(() => {
    async function deriveSmartAccount() {
      console.log("[useWallet] deriveSmartAccount called:", {
        hasEmbeddedWallet: !!embeddedWallet,
        embeddedAddress: embeddedWallet?.address,
        authenticated
      })

      if (!embeddedWallet || !authenticated) {
        console.log("[useWallet] Skipping smart account derivation:", { embeddedWallet: !!embeddedWallet, authenticated })
        setSmartAccount(null)
        setSmartAccountAddress(null)
        return
      }

      setIsSmartAccountLoading(true)
      console.log("[useWallet] Starting smart account derivation...")

      try {
        const provider = await embeddedWallet.getEthereumProvider()
        console.log("[useWallet] Got provider, creating wallet client...")

        const walletClient = createWalletClient({
          chain: baseSepolia,
          transport: custom(provider),
          account: embeddedWallet.address as Address,
        })

        const account = await toMetaMaskSmartAccount({
          client: publicClient as any,
          implementation: Implementation.Hybrid,
          deployParams: [embeddedWallet.address as Address, [], [], []],
          deploySalt: "0x",
          signer: { walletClient },
        })

        setSmartAccount(account)
        setSmartAccountAddress(account.address)

        console.log("[useWallet] Derived MetaMask Smart Account:")
        console.log("  Embedded Wallet (EOA):", embeddedWallet.address)
        console.log("  Smart Account:", account.address)
      } catch (err) {
        console.error("[useWallet] Failed to derive smart account:", err)
        setSmartAccount(null)
        setSmartAccountAddress(null)
      } finally {
        setIsSmartAccountLoading(false)
      }
    }

    if (privyReady && walletsReady && embeddedWallet) {
      deriveSmartAccount()
    }
  }, [embeddedWallet, authenticated, privyReady, walletsReady])

  const checkDelegationStatus = useCallback(async () => {
    if (!smartAccountAddress) return

    try {
      const res = await fetch("/api/delegation", {
        headers: { "x-user-address": smartAccountAddress },
      })
      const json = await res.json()

      if (json.ok && json.data.hasDelegation) {
        setIsAccountReady(true)
        setShowAccountSetup(false)
      } else {
        setIsAccountReady(false)
        setShowAccountSetup(true)
      }
    } catch {
      setIsAccountReady(false)
    }
  }, [smartAccountAddress])

  useEffect(() => {
    if (!authenticated || !smartAccountAddress) {
      setIsAccountReady(false)
      setShowAccountSetup(false)
      return
    }

    checkDelegationStatus()
  }, [authenticated, smartAccountAddress, checkDelegationStatus])

  const markAccountReady = useCallback(() => {
    setIsAccountReady(true)
    setShowAccountSetup(false)
  }, [])

  const isReady = privyReady && walletsReady
  const isConnected = authenticated && !!smartAccountAddress
  const isConnecting = !isReady || isSmartAccountLoading

  const connect = useCallback(() => {
    login()
  }, [login])

  const disconnect = useCallback(() => {
    logout()
  }, [logout])

  return {
    address: smartAccountAddress,
    embeddedWalletAddress: embeddedWallet?.address,
    isConnected,
    isConnecting,
    isSmartAccountLoading,
    isReady,
    chainId: baseSepolia.id,
    connect,
    disconnect,
    user,
    smartAccount,
    isAccountReady,
    showAccountSetup,
    setShowAccountSetup,
    markAccountReady,
    refreshAccountStatus: checkDelegationStatus,
  }
}

export function useSmartAccountBalances(
  smartAccountAddress: string | undefined,
  tokenContracts: string[] = []
) {
  const [nativeBalance, setNativeBalance] = useState<string>("0")
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBalances = useCallback(async () => {
    if (!smartAccountAddress) return

    setLoading(true)
    try {
      const ethBalance = await publicClient.getBalance({
        address: smartAccountAddress as Address,
      })
      setNativeBalance(formatUnits(ethBalance, 18))

      const balances: TokenBalance[] = []

      for (const tokenAddress of tokenContracts) {
        try {
          const [balance, decimals, symbol] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress as Address,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [smartAccountAddress as Address],
            }),
            publicClient.readContract({
              address: tokenAddress as Address,
              abi: ERC20_ABI,
              functionName: "decimals",
            }),
            publicClient.readContract({
              address: tokenAddress as Address,
              abi: ERC20_ABI,
              functionName: "symbol",
            }),
          ])

          balances.push({
            address: tokenAddress,
            symbol,
            balance: formatUnits(balance, decimals),
            rawBalance: balance,
            decimals,
          })
        } catch (err) {
          console.warn(`Failed to fetch balance for ${tokenAddress}:`, err)
        }
      }

      setTokenBalances(balances)
    } catch (err) {
      console.error("Failed to fetch balances:", err)
    } finally {
      setLoading(false)
    }
  }, [smartAccountAddress, tokenContracts])

  useEffect(() => {
    fetchBalances()
    const interval = setInterval(fetchBalances, 30000)
    return () => clearInterval(interval)
  }, [fetchBalances])

  return {
    nativeBalance,
    tokenBalances,
    loading,
    refresh: fetchBalances,
  }
}

export function useAgentTokenContracts(ownerAddress: string | undefined) {
  const [contracts, setContracts] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ownerAddress) {
      setContracts([])
      return
    }

    setLoading(true)
    fetch("/api/agents", {
      headers: { "x-owner-address": ownerAddress },
    })
      .then((res) => res.json())
      .then(async (json) => {
        if (!json.ok) return

        const allContracts: string[] = []
        for (const agent of json.data) {
          try {
            const contractsRes = await fetch(`/api/agents/${agent.id}/contracts`)
            const contractsJson = await contractsRes.json()
            if (contractsJson.ok) {
              for (const contract of contractsJson.data) {
                if (!allContracts.includes(contract.address)) {
                  allContracts.push(contract.address)
                }
              }
            }
          } catch {
            // Skip failed fetches
          }
        }
        setContracts(allContracts)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ownerAddress])

  return { contracts, loading }
}
