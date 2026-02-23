"use client"

import { useState } from "react"
import type { FunctionExport } from "autonomify-sdk"
import { useNetwork, ChainSelector } from "@/contexts/network-context"

interface ResolvedContract {
  address: string
  chain: string
  chainId: number
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

interface ContractInputProps {
  onContractResolved: (data: ResolvedContract) => void
}

export function ContractInput({ onContractResolved }: ContractInputProps) {
  const { selectedChainId, setSelectedChainId, getChain } = useNetwork()
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFetch() {
    if (!selectedChainId) {
      setError("Select a chain")
      return
    }

    if (!address) {
      setError("Enter a contract address")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Use chainId (number) instead of legacy chain name
      const res = await fetch(`/api/resolve?chainId=${selectedChainId}&address=${address}`)
      const json = await res.json()

      if (!json.ok) {
        setError(json.error || "Failed to resolve contract")
        return
      }

      onContractResolved(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  const selectedChain = selectedChainId ? getChain(selectedChainId) : null

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <ChainSelector
          value={selectedChainId}
          onChange={setSelectedChainId}
          showOnlyReady={true}
        />

        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... contract address"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />

        <button
          onClick={handleFetch}
          disabled={loading || !selectedChainId}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          {loading ? "Resolving..." : "Fetch & Resolve"}
        </button>
      </div>

      {selectedChain && (
        <div className="text-xs text-zinc-500">
          Explorer: {selectedChain.explorerUrl}
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}
