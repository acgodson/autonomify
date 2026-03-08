"use client"

import { useState, useEffect, useCallback } from "react"
import { useWallet, useSmartAccountBalances, useAgentTokenContracts, type TokenBalance } from "@/lib/wallet/hooks"
import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

type SetupStatus = "checking" | "no_delegation" | "ready"

interface AccountSetupProps {
  onReady: () => void
}

export function AccountSetup({ onReady }: AccountSetupProps) {
  const { address, isConnected, isSmartAccountLoading, smartAccount } = useWallet()
  const [status, setStatus] = useState<SetupStatus>("checking")
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    if (!address) return

    setChecking(true)
    setError(null)

    try {
      const res = await fetch("/api/delegation", {
        headers: { "x-user-address": address },
      })
      const json = await res.json()

      if (!json.ok) {
        setError(json.error || "Failed to check status")
        return
      }

      const { hasDelegation } = json.data

      if (!hasDelegation) {
        setStatus("no_delegation")
      } else {
        setStatus("ready")
        onReady()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setChecking(false)
    }
  }, [address, onReady])

  useEffect(() => {
    if (isConnected && address) {
      checkStatus()
    }
  }, [isConnected, address, checkStatus])

  if (!isConnected) {
    return (
      <div className="bg-zinc-800 rounded-lg p-6 text-center">
        <h2 className="text-xl font-semibold mb-2">Sign In</h2>
        <p className="text-zinc-400">Sign in to get started with your smart account.</p>
      </div>
    )
  }

  if (isSmartAccountLoading) {
    return (
      <div className="bg-zinc-800 rounded-lg p-6 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
        <h2 className="text-lg font-semibold mb-2">Setting Up Smart Account</h2>
        <p className="text-zinc-400 text-sm">Deriving your smart account address...</p>
      </div>
    )
  }

  if (status === "checking" || checking) {
    return (
      <div className="bg-zinc-800 rounded-lg p-6 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-zinc-400">Checking account status...</p>
      </div>
    )
  }

  if (status === "no_delegation") {
    return <DelegationSetup address={address!} smartAccount={smartAccount} onComplete={checkStatus} />
  }

  return null
}

interface DelegationSetupProps {
  address: string
  smartAccount: any
  onComplete: () => void
}

function DelegationSetup({ address, smartAccount, onComplete }: DelegationSetupProps) {
  const [step, setStep] = useState<"idle" | "checking" | "deploying" | "signing" | "saving">("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleSign() {
    if (!smartAccount) {
      setError("Smart account not ready. Please wait...")
      return
    }

    setError(null)

    try {
      setStep("checking")
      const code = await publicClient.getCode({ address: address as `0x${string}` })
      const isDeployed = code && code !== "0x"

      if (!isDeployed) {
        setStep("deploying")
        const { deploySmartAccount } = await import("@/lib/wallet")
        await deploySmartAccount(smartAccount)
      }

      setStep("signing")
      const res = await fetch("/api/delegation", {
        headers: { "x-user-address": address },
      })
      const json = await res.json()

      if (!json.ok) {
        setError(json.error || "Failed to get executor address")
        setStep("idle")
        return
      }

      const { executorAddress } = json.data

      const { signDelegation } = await import("@/lib/delegation")
      const delegation = await signDelegation(smartAccount, executorAddress)

      setStep("saving")
      const saveRes = await fetch("/api/delegation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          delegationHash: delegation.hash,
          signedDelegation: delegation.signed,
        }),
      })

      const saveJson = await saveRes.json()

      if (!saveJson.ok) {
        setError(saveJson.error || "Failed to save delegation")
        setStep("idle")
        return
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed")
      setStep("idle")
    }
  }

  const getButtonText = () => {
    switch (step) {
      case "checking": return "Checking account..."
      case "deploying": return "Deploying smart account..."
      case "signing": return "Sign in wallet..."
      case "saving": return "Saving..."
      default: return "Sign Delegation"
    }
  }

  return (
    <div className="bg-zinc-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Authorize Agent Execution</h2>
      <p className="text-zinc-400 mb-6">
        Sign a delegation to allow Autonomify agents to execute transactions on your behalf.
        You control the limits via policy settings.
      </p>

      <div className="bg-zinc-900 rounded-lg p-4 mb-6">
        <h3 className="font-medium mb-2">What this does:</h3>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 text-sm">
          <li>Authorizes the Autonomify Executor contract</li>
          <li>All transactions require ZK proof verification</li>
          <li>You can revoke anytime</li>
          <li>Your funds stay in your wallet</li>
        </ul>
      </div>

      <button
        onClick={handleSign}
        disabled={step !== "idle"}
        className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-zinc-900 font-medium py-3 rounded-lg transition-colors"
      >
        {getButtonText()}
      </button>

      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}

interface SmartAccountCardProps {
  address: string
}

export function SmartAccountCard({ address }: SmartAccountCardProps) {
  const [copied, setCopied] = useState(false)
  const { contracts } = useAgentTokenContracts(address)
  const { nativeBalance, tokenBalances, loading, refresh } = useSmartAccountBalances(address, contracts)

  const handleCopy = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance)
    if (num === 0) return "0"
    if (num < 0.000001) return "<0.000001"
    return num.toFixed(6).replace(/\.?0+$/, "")
  }

  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-500 mb-1">Smart Account</div>
          <code className="text-sm text-amber-400 break-all font-mono">{address}</code>
        </div>
        <button
          onClick={handleCopy}
          className="ml-3 flex items-center gap-1.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg text-sm transition-colors shrink-0"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <div className="border-t border-zinc-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">Balances</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {loading ? "..." : "Refresh"}
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-300">ETH</span>
            <span className="text-sm font-mono text-white">{formatBalance(nativeBalance)}</span>
          </div>

          {tokenBalances.map((token: TokenBalance) => (
            <div key={token.address} className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">{token.symbol}</span>
              <span className="text-sm font-mono text-white">{formatBalance(token.balance)}</span>
            </div>
          ))}

          {tokenBalances.length === 0 && contracts.length === 0 && (
            <p className="text-xs text-zinc-500 italic">
              Add contracts to your agents to see token balances
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
