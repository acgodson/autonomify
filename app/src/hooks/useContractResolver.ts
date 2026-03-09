"use client"

import { useState, useCallback } from "react"
import type { ContractData, ContractAnalysis } from "@/types"

export type { ContractData }

interface UseContractResolverReturn {
  contract: ContractData | null
  address: string
  setAddress: (address: string) => void
  loading: boolean
  error: string | null
  resolve: (chainId: number) => Promise<void>
  clear: () => void
}

export function useContractResolver(): UseContractResolverReturn {
  const [contract, setContract] = useState<ContractData | null>(null)
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resolve = useCallback(async (chainId: number) => {
    if (!address) {
      setError("Paste a contract address")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Fetch full data with ABI in a single call for caching
      const res = await fetch(`/api/resolve?chainId=${chainId}&address=${address}&full=true`)
      const json = await res.json()

      if (!json.ok) {
        setError(json.error || "Failed to resolve contract")
        return
      }

      let analysis: ContractAnalysis | undefined
      try {
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: json.data.address,
            chainId: chainId,
            chainConfig: json.data.chain,
            abi: json.data.abi,
            metadata: json.data.metadata,
            functions: json.data.functions,
          }),
        })
        const analyzeJson = await analyzeRes.json()
        if (analyzeJson.ok) {
          analysis = analyzeJson.data
        }
      } catch {
        // Analysis is optional
      }

      setContract({
        address: json.data.address,
        chain: json.data.chain.name,
        chainId: json.data.chain.id,
        metadata: json.data.metadata,
        functions: json.data.functions,
        analysis,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }, [address])

  const clear = useCallback(() => {
    setContract(null)
    setAddress("")
    setError(null)
  }, [])

  return {
    contract,
    address,
    setAddress,
    loading,
    error,
    resolve,
    clear,
  }
}
