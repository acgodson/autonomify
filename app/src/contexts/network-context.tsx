"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"


export type NetworkMode = "testnet" | "mainnet"

export interface ChainInfo {
  id: number
  name: string
  shortName: string
  testnet: boolean
  nativeSymbol: string
  explorerUrl: string
  ready: boolean
  executorDeployed: boolean
}

interface NetworkContextValue {
  mode: NetworkMode
  setMode: (mode: NetworkMode) => void
  toggleMode: () => void
  chains: ChainInfo[]
  readyChains: ChainInfo[]
  isLoading: boolean
  error: string | null
  selectedChainId: number | null
  setSelectedChainId: (id: number) => void
  getChain: (id: number) => ChainInfo | undefined
  refetch: () => Promise<void>
}

const NetworkContext = createContext<NetworkContextValue | null>(null)


const STORAGE_KEY = "autonomify:networkMode"
const CHAIN_STORAGE_KEY = "autonomify:selectedChainId"


interface NetworkProviderProps {
  children: ReactNode
  defaultMode?: NetworkMode
}

export function NetworkProvider({
  children,
  defaultMode = "testnet",
}: NetworkProviderProps) {

  const [mode, setModeState] = useState<NetworkMode>(defaultMode)
  const [chains, setChains] = useState<ChainInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedChainId, setSelectedChainIdState] = useState<number | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === "mainnet" || saved === "testnet") {
        setModeState(saved)
      }

      const savedChain = localStorage.getItem(CHAIN_STORAGE_KEY)
      if (savedChain) {
        setSelectedChainIdState(parseInt(savedChain, 10))
      }
    }
  }, [])

  const setMode = useCallback((newMode: NetworkMode) => {
    setModeState(newMode)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newMode)
    }
    setSelectedChainIdState(null)
    if (typeof window !== "undefined") {
      localStorage.removeItem(CHAIN_STORAGE_KEY)
    }
  }, [])

  const toggleMode = useCallback(() => {
    setMode(mode === "testnet" ? "mainnet" : "testnet")
  }, [mode, setMode])

  const setSelectedChainId = useCallback((id: number) => {
    setSelectedChainIdState(id)
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAIN_STORAGE_KEY, id.toString())
    }
  }, [])

  const fetchChains = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/chains?mode=${mode}`)
      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || "Failed to fetch chains")
      }

      setChains(json.data.chains)

      // Auto-select first ready chain if none selected
      if (!selectedChainId) {
        const firstReady = json.data.chains.find((c: ChainInfo) => c.ready)
        if (firstReady) {
          setSelectedChainId(firstReady.id)
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setChains([])
    } finally {
      setIsLoading(false)
    }
  }, [mode, selectedChainId, setSelectedChainId])

  // Fetch on mount and mode change
  useEffect(() => {
    fetchChains()
  }, [fetchChains])

  // Computed values
  const readyChains = chains.filter((c) => c.ready)

  const getChain = useCallback(
    (id: number) => chains.find((c) => c.id === id),
    [chains]
  )

  // Context value
  const value: NetworkContextValue = {
    mode,
    setMode,
    toggleMode,
    chains,
    readyChains,
    isLoading,
    error,
    selectedChainId,
    setSelectedChainId,
    getChain,
    refetch: fetchChains,
  }

  return (
    <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>
  )
}

// =============================================================================
// HOOK
// =============================================================================

export function useNetwork() {
  const context = useContext(NetworkContext)
  if (!context) {
    throw new Error("useNetwork must be used within a NetworkProvider")
  }
  return context
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Network mode toggle button for the navbar.
 */
export function NetworkToggle() {
  const { mode, toggleMode, isLoading } = useNetwork()

  return (
    <button
      onClick={toggleMode}
      disabled={isLoading}
      className={`
        px-3 py-1.5 rounded-full text-xs font-medium transition-all
        ${
          mode === "testnet"
            ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
            : "bg-green-500/20 text-green-400 border border-green-500/30"
        }
        hover:opacity-80 disabled:opacity-50
      `}
    >
      {mode === "testnet" ? "Testnet" : "Mainnet"}
    </button>
  )
}

/**
 * Chain selector dropdown.
 */
interface ChainSelectorProps {
  value: number | null
  onChange: (chainId: number) => void
  showOnlyReady?: boolean
  className?: string
}

export function ChainSelector({
  value,
  onChange,
  showOnlyReady = true,
  className = "",
}: ChainSelectorProps) {
  const { chains, readyChains, isLoading } = useNetwork()

  const displayChains = showOnlyReady ? readyChains : chains

  if (isLoading) {
    return (
      <div className={`bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-500 ${className}`}>
        Loading chains...
      </div>
    )
  }

  if (displayChains.length === 0) {
    return (
      <div className={`bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-500 ${className}`}>
        No chains available
      </div>
    )
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className={`
        bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white
        focus:outline-none focus:ring-2 focus:ring-blue-500
        ${className}
      `}
    >
      <option value="" disabled>
        Select chain
      </option>
      {displayChains.map((chain) => (
        <option key={chain.id} value={chain.id}>
          {chain.name}
          {!chain.ready && " (not ready)"}
        </option>
      ))}
    </select>
  )
}
