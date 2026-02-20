"use client"

import { useState } from "react"
import type { FunctionExport } from "autonomify-sdk"

interface ResolvedContract {
  address: string
  chain: string
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

interface ContractInputProps {
  onContractResolved: (data: ResolvedContract) => void
}

const CHAINS = [
  { id: "bscTestnet", name: "BSC Testnet" },
]

export function ContractInput({ onContractResolved }: ContractInputProps) {
  const [address, setAddress] = useState("")
  const [chain, setChain] = useState("bscTestnet")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFetch() {
    if (!address) {
      setError("Enter a contract address")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/resolve?chain=${chain}&address=${address}`)
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

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={chain}
          onChange={(e) => setChain(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {CHAINS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... contract address"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
        />

        <button
          onClick={handleFetch}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          {loading ? "Resolving..." : "Fetch & Resolve"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}
