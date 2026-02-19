"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { FunctionList } from "@/components/function-list"
import type { FunctionInfo } from "@/lib/autonomify-core"

interface ContractAnalysis {
  summary: string
  contractType: string
  capabilities: string[]
  functionDescriptions: Record<string, string>
}

interface ContractData {
  address: string
  chain: string
  metadata: Record<string, unknown>
  functions: FunctionInfo[]
  analysis?: ContractAnalysis
}

type AgentType = "telegram" | "discord" | "self_hosted"

interface AgentData {
  id: string
  name: string
  type: AgentType
  walletAddress?: string
  agentIdBytes?: string
  contractCount: number
}

const CHAINS = [{ id: "bscTestnet", name: "BSC Testnet" }]

const LOADING_WORDS = [
  "Fetching ABI...",
  "Reading contract...",
  "Extracting functions...",
  "Resolving metadata...",
  "Analyzing with AI...",
  "Understanding capabilities...",
  "Almost there...",
]

function MagicWandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 4V2" />
      <path d="M15 16v-2" />
      <path d="M8 9h2" />
      <path d="M20 9h2" />
      <path d="M17.8 11.8L19 13" />
      <path d="M15 9h.01" />
      <path d="M17.8 6.2L19 5" />
      <path d="m3 21 9-9" />
      <path d="M12.2 6.2L11 5" />
    </svg>
  )
}

function SpinningCube({ className, delay, color, variant = 1 }: { className: string; delay: number; color: string; variant?: 1 | 2 }) {
  return (
    <div
      className={`${className} ${color} pointer-events-none`}
      style={{
        animation: `randomSpin${variant === 2 ? '2' : ''} ${10 + delay}s ease-out infinite`,
        animationDelay: `${delay}s`,
      }}
    />
  )
}

function MagicUnderline() {
  return (
    <svg
      className="absolute -bottom-4 left-0 w-full h-5"
      viewBox="0 0 200 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="none"
    >
      <path
        d="M3 12 C20 8, 40 16, 60 10 C80 4, 100 14, 120 8 C140 2, 160 12, 180 6 C190 3, 195 8, 197 10"
        stroke="url(#wandGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        className="animate-draw"
      />
      <defs>
        <linearGradient id="wandGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.6" />
        </linearGradient>
      </defs>
    </svg>
  )
}

function GridPattern() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Gradient grid overlay */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="gridPattern"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          </pattern>
          <radialGradient id="gridFade" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="gridMask">
            <rect width="100%" height="100%" fill="url(#gridFade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#gridPattern)" mask="url(#gridMask)" />
      </svg>

      {/* Floating spinning cubes - larger and more visible */}
      <SpinningCube className="absolute top-24 left-12 w-8 h-8 rotate-45" delay={0} color="bg-amber-500/30" variant={1} />
      <SpinningCube className="absolute top-44 right-24 w-6 h-6 rotate-12" delay={3} color="bg-blue-500/35" variant={2} />
      <SpinningCube className="absolute top-72 left-1/4 w-10 h-10 rotate-45" delay={6} color="bg-purple-500/25" variant={1} />
      <SpinningCube className="absolute bottom-48 right-1/4 w-7 h-7 rotate-45" delay={9} color="bg-amber-500/30" variant={2} />
      <SpinningCube className="absolute top-1/3 right-16 w-9 h-9 rotate-12" delay={2} color="bg-cyan-500/25" variant={1} />
      <SpinningCube className="absolute top-1/2 left-20 w-6 h-6 rotate-45" delay={5} color="bg-green-500/30" variant={2} />
      <SpinningCube className="absolute bottom-72 left-1/3 w-8 h-8 rotate-12" delay={8} color="bg-pink-500/25" variant={1} />
      <SpinningCube className="absolute top-36 left-1/2 w-5 h-5 rotate-45" delay={4} color="bg-amber-400/20" variant={2} />
      <SpinningCube className="absolute bottom-32 right-16 w-7 h-7 rotate-12" delay={7} color="bg-blue-400/25" variant={1} />
    </div>
  )
}

function LoadingAnimation({ word }: { word: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <MagicWandIcon className="w-8 h-8 text-amber-400 animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
        <span className="text-zinc-400 text-sm">{word}</span>
      </div>
    </div>
  )
}

export default function Home() {
  const [contract, setContract] = useState<ContractData | null>(null)
  const [agents, setAgents] = useState<AgentData[]>([])
  const [showLaunchModal, setShowLaunchModal] = useState(false)
  const [showAgentPanel, setShowAgentPanel] = useState(false)
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AgentData | null>(null)
  const [launchedAgent, setLaunchedAgent] = useState<{
    id: string
    name: string
    type: AgentType
    walletAddress?: string
    agentIdBytes?: string
    isNew: boolean
  } | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSelfHostedModal, setShowSelfHostedModal] = useState<{
    agentId: string
    agentName: string
    agentIdBytes: string
  } | null>(null)

  const [address, setAddress] = useState("")
  const [chain, setChain] = useState("bscTestnet")
  const [loading, setLoading] = useState(false)
  const [loadingWordIndex, setLoadingWordIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [heroScale, setHeroScale] = useState(1)

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      // Scale from 1 to 0.7 as user scrolls from 0 to 300px
      const scale = Math.max(0.7, 1 - scrollY / 1000)
      setHeroScale(scale)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    if (!loading) return
    const interval = setInterval(() => {
      setLoadingWordIndex((prev) => (prev + 1) % LOADING_WORDS.length)
    }, 1200)
    return () => clearInterval(interval)
  }, [loading])

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((json) => {
        if (json.ok) setAgents(json.data)
      })
      .catch(() => {})
  }, [])

  async function handleAutonomify() {
    if (!address) {
      setError("Paste a contract address")
      return
    }

    setLoading(true)
    setError(null)
    setLoadingWordIndex(0)

    try {
      // Step 1: Resolve contract ABI and metadata
      const res = await fetch(`/api/resolve?chain=${chain}&address=${address}`)
      const json = await res.json()

      if (!json.ok) {
        setError(json.error || "Failed to resolve contract")
        return
      }

      // Step 2: Analyze with LLM for context
      let analysis: ContractAnalysis | undefined
      try {
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: json.data.address,
            metadata: json.data.metadata,
            functions: json.data.functions,
          }),
        })
        const analyzeJson = await analyzeRes.json()
        if (analyzeJson.ok) {
          analysis = analyzeJson.data
        }
      } catch {
        // Analysis is optional, continue without it
      }

      setContract({
        address: json.data.address,
        chain: json.data.chain,
        metadata: json.data.metadata,
        functions: json.data.functions,
        analysis,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  const totalContracts = agents.reduce((sum, a) => sum + a.contractCount, 0)

  return (
    <main className="h-screen bg-zinc-950 text-white relative overflow-hidden flex flex-col">
      <GridPattern />

      <nav className="fixed top-0 left-0 right-0 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/autonomify_icon.png"
              alt="Autonomify"
              width={70}
              height={70}
              className="object-contain"
            />
            <span
              className="text-lg font-bold text-white pixel-text relative"
              data-text="Autonomify"
            >
              Autonomify
            </span>
          </div>
          {agents.length > 0 && (
            <button
              onClick={() => setShowAgentPanel(!showAgentPanel)}
              className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 rounded-full px-4 py-2 transition-colors"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm">{agents.length} agent{agents.length > 1 ? "s" : ""}</span>
            </button>
          )}
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10">
        {/* Hero Section with Scale Animation */}
        <div 
          className="flex flex-col items-center justify-center transition-transform duration-300 ease-out"
          style={{ 
            transform: `scale(${heroScale})`,
            minHeight: contract ? 'auto' : 'calc(100vh - 200px)'
          }}
        >
          <div className="text-center mb-16 max-w-4xl">
            <p className="text-zinc-300 text-4xl md:text-5xl leading-tight">
              Turn any <span className="gradient-text">verified contract</span> into a{" "}
              <span className="relative inline-block">
                Telegram agent
                <MagicUnderline />
              </span>
              {" "}and <span className="text-zinc-500">more..</span>
            </p>
          </div>

          <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-8 border border-zinc-800 mb-8 w-full max-w-4xl">
            <div className="flex gap-4">
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:20px] bg-[right_1rem_center] bg-no-repeat pr-12"
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
                placeholder="Paste contract address (0x...)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-6 py-5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xl"
                onKeyDown={(e) => e.key === "Enter" && handleAutonomify()}
              />

              <button
                onClick={handleAutonomify}
                disabled={loading}
                className="flex items-center gap-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-semibold px-10 py-5 rounded-xl transition-all text-xl"
              >
                <MagicWandIcon className="w-6 h-6" />
                {loading ? "..." : "Autonomify"}
              </button>
            </div>

            {loading && (
              <div className="mt-6 flex justify-center">
                <LoadingAnimation word={LOADING_WORDS[loadingWordIndex]} />
              </div>
            )}

            {error && (
              <div className="mt-6 bg-red-900/30 border border-red-800 text-red-400 px-5 py-4 rounded-xl text-lg">
                {error}
              </div>
            )}
          </div>
        </div>

        {contract && (
          <>
            <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <code className="text-blue-400">{contract.address}</code>
                  {contract.analysis?.contractType && (
                    <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded-full">
                      {contract.analysis.contractType}
                    </span>
                  )}
                </div>
                <span className="text-zinc-500 text-sm">
                  {contract.functions.length} functions
                </span>
              </div>

              {contract.analysis?.summary && (
                <p className="text-zinc-300 mb-4">{contract.analysis.summary}</p>
              )}

              {contract.analysis?.capabilities && contract.analysis.capabilities.length > 0 && (
                <div className="mb-6">
                  <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">
                    Capabilities
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contract.analysis.capabilities.map((cap, i) => (
                      <span
                        key={i}
                        className="bg-zinc-800 text-zinc-300 text-sm px-3 py-1 rounded-full"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(contract.metadata).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {Object.entries(contract.metadata).map(([key, value]) => (
                    <div key={key} className="bg-zinc-800/50 rounded-xl p-3">
                      <div className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                        {key}
                      </div>
                      <div className="text-white font-medium truncate">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <FunctionList
                functions={contract.functions}
                descriptions={contract.analysis?.functionDescriptions}
              />
            </div>

            <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-6">
              <h2 className="text-lg font-medium mb-4">Launch Agent</h2>
              <div className="grid grid-cols-3 gap-4">
                {/* Telegram */}
                <button
                  onClick={() => setShowLaunchModal(true)}
                  className="flex flex-col items-center justify-center gap-2 bg-[#0088cc] hover:bg-[#0099dd] text-white font-medium py-5 px-4 rounded-xl transition-colors"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.65-2.89 7.99-3.45 3.8-1.6 4.59-1.88 5.1-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span className="text-sm">Telegram</span>
                </button>

                {/* Discord - Coming Soon */}
                <button
                  disabled
                  className="flex flex-col items-center justify-center gap-2 bg-zinc-800 text-zinc-500 font-medium py-5 px-4 rounded-xl cursor-not-allowed relative overflow-hidden"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span className="text-sm">Discord</span>
                  <span className="absolute top-1 right-1 text-[10px] bg-zinc-700 px-1.5 py-0.5 rounded-full">Soon</span>
                </button>

                {/* Self-Hosted SDK */}
                <button
                  onClick={() => setShowLaunchModal(true)}
                  className="flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-900 font-medium py-5 px-4 rounded-xl transition-colors"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 16 4-4-4-4" />
                    <path d="m6 8-4 4 4 4" />
                    <path d="m14.5 4-5 16" />
                  </svg>
                  <span className="text-sm">Self-Hosted</span>
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <button
                  onClick={() => setShowExportModal(true)}
                  className="text-zinc-500 hover:text-zinc-300 text-sm"
                >
                  Export as Tool Schema →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-6 py-3 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-8 text-sm">
          <div className="text-zinc-500">
            <span className="text-white font-medium">{agents.length}</span> agents
          </div>
          <div className="text-zinc-500">
            <span className="text-white font-medium">{totalContracts}</span> contracts
          </div>
          <div className="text-zinc-500">
            BSC Testnet
          </div>
        </div>
      </footer>

      {showAgentPanel && (
        <div className="fixed inset-0 z-50" onClick={() => setShowAgentPanel(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-96 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Your Agents</h2>
              <button
                onClick={() => setShowAgentPanel(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-zinc-800 rounded-xl p-4 cursor-pointer hover:bg-zinc-700/80 transition-colors"
                  onClick={() => setSelectedAgentDetail(agent)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    <AgentTypeBadge type={agent.type} />
                  </div>
                  <div className="text-xs text-zinc-500 mb-1">
                    {agent.contractCount} contract{agent.contractCount !== 1 ? "s" : ""}
                  </div>
                  {agent.walletAddress ? (
                    <code className="text-xs text-zinc-400 break-all">
                      {agent.walletAddress}
                    </code>
                  ) : agent.agentIdBytes ? (
                    <code className="text-xs text-amber-400/70 break-all">
                      Agent ID: {agent.agentIdBytes.slice(0, 18)}...
                    </code>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedAgentDetail && (
        <AgentDetailModal
          agent={selectedAgentDetail}
          onClose={() => setSelectedAgentDetail(null)}
          onOpenSetup={() => {
            if (selectedAgentDetail.type === "self_hosted" && selectedAgentDetail.agentIdBytes) {
              setShowSelfHostedModal({
                agentId: selectedAgentDetail.id,
                agentName: selectedAgentDetail.name,
                agentIdBytes: selectedAgentDetail.agentIdBytes,
              })
            }
            setSelectedAgentDetail(null)
          }}
        />
      )}

      {showLaunchModal && contract && (
        <LaunchModal
          contract={contract}
          agents={agents}
          onClose={() => setShowLaunchModal(false)}
          onLaunched={(agent) => {
            setLaunchedAgent(agent)
            setAgents((prev) => {
              const exists = prev.find((a) => a.id === agent.id)
              if (exists) {
                return prev.map((a) =>
                  a.id === agent.id ? { ...a, contractCount: a.contractCount + 1 } : a
                )
              }
              return [
                ...prev,
                {
                  id: agent.id,
                  name: agent.name,
                  type: agent.type,
                  walletAddress: agent.walletAddress,
                  agentIdBytes: agent.agentIdBytes,
                  contractCount: 1,
                },
              ]
            })
            setShowLaunchModal(false)
            // Show self-hosted setup modal after creation
            if (agent.isNew && agent.type === "self_hosted" && agent.agentIdBytes) {
              setShowSelfHostedModal({
                agentId: agent.id,
                agentName: agent.name,
                agentIdBytes: agent.agentIdBytes,
              })
            }
          }}
        />
      )}

      {launchedAgent && (
        <LaunchedModal
          agent={launchedAgent}
          onClose={() => setLaunchedAgent(null)}
        />
      )}

      {showExportModal && contract && (
        <ExportModal
          contract={contract}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showSelfHostedModal && (
        <SelfHostedSetupModal
          agentId={showSelfHostedModal.agentId}
          agentName={showSelfHostedModal.agentName}
          agentIdBytes={showSelfHostedModal.agentIdBytes}
          onClose={() => setShowSelfHostedModal(null)}
        />
      )}
    </main>
  )
}

function AgentTypeBadge({ type, size = "sm" }: { type: AgentType; size?: "sm" | "md" }) {
  const styles = {
    telegram: "bg-[#0088cc]/20 text-[#0088cc]",
    discord: "bg-[#5865F2]/20 text-[#5865F2]",
    self_hosted: "bg-amber-500/20 text-amber-400",
  }

  const labels = {
    telegram: "Telegram",
    discord: "Discord",
    self_hosted: "Self-Hosted",
  }

  const sizeStyles = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"

  return (
    <span className={`${styles[type]} ${sizeStyles} rounded-full font-medium`}>
      {labels[type]}
    </span>
  )
}

function LaunchModal({
  contract,
  agents,
  onClose,
  onLaunched,
}: {
  contract: ContractData
  agents: AgentData[]
  onClose: () => void
  onLaunched: (agent: {
    id: string
    name: string
    type: AgentType
    walletAddress?: string
    agentIdBytes?: string
    isNew: boolean
  }) => void
}) {
  const [step, setStep] = useState<"type" | "config">("type")
  const [agentType, setAgentType] = useState<AgentType>("telegram")
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compatibleAgents = agents.filter((a) => a.type === agentType)

  function handleSelectType(type: AgentType) {
    setAgentType(type)
    const compatible = agents.filter((a) => a.type === type)
    if (compatible.length > 0) {
      setMode("existing")
      setSelectedAgentId(compatible[0].id)
    } else {
      setMode("new")
      setSelectedAgentId("")
    }
    setStep("config")
  }

  async function handleLaunch() {
    setLoading(true)
    setError(null)

    try {
      if (mode === "existing") {
        if (!selectedAgentId) {
          setError("Select an agent")
          return
        }

        await fetch(`/api/agents/${selectedAgentId}/contracts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chain: "bscTestnet", address: contract.address }),
        })

        const agent = agents.find((a) => a.id === selectedAgentId)!
        onLaunched({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          walletAddress: agent.walletAddress,
          agentIdBytes: agent.agentIdBytes,
          isNew: false,
        })
      } else {
        if (!name.trim()) {
          setError("Enter an agent name")
          return
        }

        if (agentType === "telegram" && !token.trim()) {
          setError("Enter a Telegram bot token")
          return
        }

        const body: Record<string, string> = {
          name: name.trim(),
          type: agentType,
        }
        if (agentType === "telegram") {
          body.telegramBotToken = token.trim()
        }

        const agentRes = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const agentJson = await agentRes.json()

        if (!agentJson.ok) {
          setError(agentJson.error || "Failed to create agent")
          return
        }

        await fetch(`/api/agents/${agentJson.data.id}/contracts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chain: "bscTestnet", address: contract.address }),
        })

        if (agentType === "telegram") {
          await fetch(`/api/agents/${agentJson.data.id}/webhook`, {
            method: "POST",
          })
        }

        onLaunched({
          id: agentJson.data.id,
          name: agentJson.data.name,
          type: agentType,
          walletAddress: agentJson.data.walletAddress,
          agentIdBytes: agentJson.data.agentIdBytes,
          isNew: true,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {step === "config" && (
              <button
                onClick={() => setStep("type")}
                className="text-zinc-500 hover:text-white"
              >
                ←
              </button>
            )}
            <h2 className="text-xl font-semibold">
              {step === "type" ? "Choose Agent Type" : `Launch ${agentType === "telegram" ? "Telegram" : agentType === "self_hosted" ? "Self-Hosted" : "Discord"} Agent`}
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        {step === "type" ? (
          <div className="space-y-3">
            {/* Telegram Option */}
            <button
              onClick={() => handleSelectType("telegram")}
              className="w-full flex items-center gap-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-[#0088cc] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.65-2.89 7.99-3.45 3.8-1.6 4.59-1.88 5.1-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Telegram Bot</div>
                <div className="text-sm text-zinc-400">Hosted agent with Privy wallet</div>
              </div>
              <span className="text-zinc-500">→</span>
            </button>

            {/* Discord Option - Coming Soon */}
            <button
              disabled
              className="w-full flex items-center gap-4 bg-zinc-800/50 rounded-xl p-4 text-left cursor-not-allowed relative overflow-hidden"
            >
              <div className="w-12 h-12 bg-[#5865F2]/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white/50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-zinc-500">Discord Bot</div>
                <div className="text-sm text-zinc-600">Coming soon</div>
              </div>
              <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-1 rounded-full">Soon</span>
            </button>

            {/* Self-Hosted SDK */}
            <button
              onClick={() => handleSelectType("self_hosted")}
              className="w-full flex items-center gap-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m18 16 4-4-4-4" />
                  <path d="m6 8-4 4 4 4" />
                  <path d="m14.5 4-5 16" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Self-Hosted SDK</div>
                <div className="text-sm text-zinc-400">Use your own wallet & infrastructure</div>
              </div>
              <span className="text-zinc-500">→</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {compatibleAgents.length > 0 && (
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMode("existing")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "existing"
                      ? agentType === "telegram" ? "bg-[#0088cc] text-white" : "bg-amber-500 text-zinc-900"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  Add to Existing
                </button>
                <button
                  onClick={() => setMode("new")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    mode === "new"
                      ? agentType === "telegram" ? "bg-[#0088cc] text-white" : "bg-amber-500 text-zinc-900"
                      : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  Create New
                </button>
              </div>
            )}

            {mode === "existing" ? (
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Select Agent</label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {compatibleAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.contractCount} contracts)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">Agent Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={agentType === "self_hosted" ? "My DeFi Agent" : "My Token Agent"}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                {agentType === "telegram" && (
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">
                      Telegram Bot Token
                    </label>
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="123456:ABC-DEF..."
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                    />
                    <p className="mt-2 text-xs text-zinc-500">
                      Get one from{" "}
                      <a
                        href="https://t.me/BotFather"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        @BotFather
                      </a>
                    </p>
                  </div>
                )}

                {agentType === "self_hosted" && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <MagicWandIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm text-amber-400 font-medium">Self-Hosted Setup</div>
                        <div className="text-xs text-zinc-400 mt-1">
                          After creation, you&apos;ll get setup instructions with code snippets for Vercel AI SDK or OpenAI. Bring your own wallet.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleLaunch}
              disabled={loading}
              className={`w-full font-semibold py-4 rounded-xl transition-colors disabled:bg-zinc-700 disabled:cursor-not-allowed ${
                agentType === "telegram"
                  ? "bg-[#0088cc] hover:bg-[#0099dd] text-white"
                  : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-900"
              }`}
            >
              {loading ? "Creating..." : mode === "existing" ? "Add Contract" : agentType === "self_hosted" ? "Create Agent" : "Launch Agent"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function LaunchedModal({
  agent,
  onClose,
}: {
  agent: {
    id: string
    name: string
    type: AgentType
    walletAddress?: string
    agentIdBytes?: string
    isNew: boolean
  }
  onClose: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  // Self-hosted agents show success briefly then go to setup modal
  if (agent.type === "self_hosted" && agent.isNew) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">{agent.name} Created!</h2>
          <p className="text-zinc-400 text-sm mb-4">Opening setup instructions...</p>
          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">
            {agent.isNew ? `${agent.name} Launched!` : "Contract Added!"}
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            {agent.isNew ? "Your agent wallet is secured by Privy" : `Added to ${agent.name}`}
          </p>
        </div>

        {agent.isNew && agent.walletAddress && (
          <>
            <div className="space-y-3 mb-6">
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-500 mb-1">Wallet Address</div>
                    <code className="text-sm text-blue-400 break-all">{agent.walletAddress}</code>
                  </div>
                  <button
                    onClick={() => copy(agent.walletAddress!, "address")}
                    className="text-zinc-500 hover:text-white text-sm ml-2 shrink-0"
                  >
                    {copied === "address" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="bg-green-900/20 border border-green-800/50 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div>
                    <div className="text-sm text-green-400 font-medium">Secured by Privy</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      Private keys are managed securely. All transactions route through the Autonomify Executor contract for audit trails.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <a
              href="https://www.bnbchain.org/en/testnet-faucet"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 py-3 rounded-xl transition-colors mb-3"
            >
              Fund with testnet BNB
            </a>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  )
}

function AgentDetailModal({
  agent,
  onClose,
  onOpenSetup,
}: {
  agent: AgentData
  onClose: () => void
  onOpenSetup: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <h2 className="text-xl font-semibold">{agent.name}</h2>
            <AgentTypeBadge type={agent.type} size="md" />
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 mb-1">Contracts</div>
            <div className="text-white font-medium">{agent.contractCount} contract{agent.contractCount !== 1 ? "s" : ""}</div>
          </div>

          {agent.walletAddress && (
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500 mb-1">Wallet Address</div>
                  <code className="text-sm text-blue-400 break-all">{agent.walletAddress}</code>
                </div>
                <button
                  onClick={() => copy(agent.walletAddress!, "address")}
                  className="text-zinc-500 hover:text-white text-sm ml-2 shrink-0"
                >
                  {copied === "address" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {agent.agentIdBytes && (
            <div className="bg-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500 mb-1">Agent ID (bytes32)</div>
                  <code className="text-xs text-amber-400 break-all">{agent.agentIdBytes}</code>
                </div>
                <button
                  onClick={() => copy(agent.agentIdBytes!, "agentId")}
                  className="text-zinc-500 hover:text-white text-sm ml-2 shrink-0"
                >
                  {copied === "agentId" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {agent.type === "self_hosted" && (
            <button
              onClick={onOpenSetup}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-900 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 16 4-4-4-4" />
                <path d="m6 8-4 4 4 4" />
                <path d="m14.5 4-5 16" />
              </svg>
              View Setup Instructions
            </button>
          )}

          {agent.type === "telegram" && agent.walletAddress && (
            <a
              href="https://www.bnbchain.org/en/testnet-faucet"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 py-3 rounded-xl transition-colors"
            >
              Fund with testnet BNB
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function SelfHostedSetupModal({
  agentId,
  agentName,
  agentIdBytes,
  onClose,
}: {
  agentId: string
  agentName: string
  agentIdBytes: string
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<"cli" | "manual">("cli")
  const [manualFramework, setManualFramework] = useState<"vercel" | "openai">("vercel")
  const [copied, setCopied] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const apiUrl = typeof window !== "undefined" ? `${window.location.origin}/api/agents/${agentId}/export` : ""

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  async function downloadConfig() {
    setDownloading(true)
    try {
      const res = await fetch(apiUrl)
      const json = await res.json()
      if (json.ok) {
        const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "autonomify.json"
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch {
      // Handle error silently
    } finally {
      setDownloading(false)
    }
  }

  const cliCommand = `npx create-autonomify --agent ${agentId}`

  const vercelCode = `import { createAutonomifyTool, buildSystemPrompt } from 'autonomify-sdk'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'
import config from './autonomify.json'

// Setup your wallet
const account = privateKeyToAccount(process.env.PRIVATE_KEY)
const walletClient = createWalletClient({
  account,
  chain: bscTestnet,
  transport: http(),
})

// Create signing function
const signAndSend = async (tx) => {
  return await walletClient.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
  })
}

// Create the tool
const autonomifyTool = createAutonomifyTool({
  export: config,
  agentId: '${agentIdBytes}',
  signAndSend,
})

// Use with Vercel AI SDK
const { text } = await generateText({
  model: openai('gpt-4o'),
  system: buildSystemPrompt(config),
  tools: { autonomify_execute: autonomifyTool },
  prompt: 'Transfer 100 USDT to 0x...',
  maxSteps: 5,
})`

  const openaiCode = `import { createOpenAITool, buildSystemPrompt } from 'autonomify-sdk'
import OpenAI from 'openai'
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { bscTestnet } from 'viem/chains'
import config from './autonomify.json'

const openai = new OpenAI()

// Setup your wallet
const account = privateKeyToAccount(process.env.PRIVATE_KEY)
const walletClient = createWalletClient({
  account,
  chain: bscTestnet,
  transport: http(),
})

// Create signing function
const signAndSend = async (tx) => {
  return await walletClient.sendTransaction({
    to: tx.to,
    data: tx.data,
    value: tx.value,
  })
}

// Create the tool
const { tools, handler } = createOpenAITool({
  export: config,
  agentId: '${agentIdBytes}',
  signAndSend,
})

// Use with OpenAI SDK
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: buildSystemPrompt(config) },
    { role: 'user', content: 'Transfer 100 USDT to 0x...' },
  ],
  tools,
})

// Handle tool calls
for (const toolCall of response.choices[0].message.tool_calls || []) {
  const result = await handler(toolCall)
  console.log(result)
}`

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-semibold">{agentName}</h2>
                <AgentTypeBadge type="self_hosted" size="md" />
              </div>
              <p className="text-sm text-zinc-400">Self-Hosted SDK Setup</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white">
              ✕
            </button>
          </div>

          {/* Setup Method Tabs */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("cli")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "cli"
                  ? "bg-amber-500 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              Quick Start (CLI)
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "manual"
                  ? "bg-amber-500 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 16 4-4-4-4" />
                <path d="m6 8-4 4 4 4" />
                <path d="m14.5 4-5 16" />
              </svg>
              Manual Setup
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "cli" ? (
            <div className="space-y-6">
              {/* CLI Command - Hero */}
              <div className="bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center">
                    <MagicWandIcon className="w-5 h-5 text-zinc-900" />
                  </div>
                  <div>
                    <div className="text-white font-semibold">One Command Setup</div>
                    <div className="text-sm text-zinc-400">Creates a ready-to-run project with your agent config</div>
                  </div>
                </div>
                <div className="relative">
                  <pre className="bg-zinc-900 rounded-lg p-4 text-amber-400 font-mono text-sm overflow-x-auto">
                    {cliCommand}
                  </pre>
                  <button
                    onClick={() => copy(cliCommand, "cli")}
                    className="absolute top-2 right-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    {copied === "cli" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* What it does */}
              <div className="space-y-3">
                <div className="text-sm text-zinc-400 font-medium">What this does:</div>
                <div className="grid gap-3">
                  {[
                    { icon: "📦", text: "Creates a new project folder" },
                    { icon: "⬇️", text: "Downloads your agent configuration" },
                    { icon: "🔧", text: "Sets up TypeScript + your chosen SDK" },
                    { icon: "🔑", text: "Configures wallet signing boilerplate" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-800/50 rounded-lg p-3">
                      <span className="text-lg">{item.icon}</span>
                      <span className="text-sm text-zinc-300">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Framework choice info */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="text-sm text-zinc-400">
                  The CLI will ask you to choose between <span className="text-white">Vercel AI SDK</span> or <span className="text-white">OpenAI SDK</span>. Both generate production-ready code.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Download Config */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-xs font-bold text-zinc-900">1</div>
                  <div className="font-medium text-white">Download Configuration</div>
                </div>
                <p className="text-sm text-zinc-400 mb-4">
                  Get your agent&apos;s contract ABIs, chain config, and metadata.
                </p>
                <button
                  onClick={downloadConfig}
                  disabled={downloading}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-zinc-900 font-semibold py-3 rounded-xl transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {downloading ? "Downloading..." : "Download autonomify.json"}
                </button>
              </div>

              {/* Step 2: Install SDK */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 bg-zinc-600 rounded-full flex items-center justify-center text-xs font-bold text-white">2</div>
                  <div className="font-medium text-white">Install SDK</div>
                </div>
                <div className="relative">
                  <pre className="bg-zinc-900 rounded-lg p-3 text-zinc-300 font-mono text-sm">
                    npm install autonomify-sdk viem
                  </pre>
                  <button
                    onClick={() => copy("npm install autonomify-sdk viem", "install")}
                    className="absolute top-2 right-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded text-xs"
                  >
                    {copied === "install" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Step 3: Integrate */}
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 bg-zinc-600 rounded-full flex items-center justify-center text-xs font-bold text-white">3</div>
                  <div className="font-medium text-white">Integrate</div>
                </div>

                {/* Framework sub-tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setManualFramework("vercel")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      manualFramework === "vercel"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-800 text-zinc-500 hover:text-white"
                    }`}
                  >
                    Vercel AI SDK
                  </button>
                  <button
                    onClick={() => setManualFramework("openai")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      manualFramework === "openai"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-800 text-zinc-500 hover:text-white"
                    }`}
                  >
                    OpenAI SDK
                  </button>
                </div>

                <div className="relative">
                  <pre className="bg-zinc-900 rounded-lg p-4 text-zinc-300 font-mono text-xs overflow-x-auto max-h-64">
                    {manualFramework === "vercel" ? vercelCode : openaiCode}
                  </pre>
                  <button
                    onClick={() => copy(manualFramework === "vercel" ? vercelCode : openaiCode, "code")}
                    className="absolute top-2 right-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded text-xs"
                  >
                    {copied === "code" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Agent ID Section - always visible */}
          <div className="mt-6 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-amber-400 font-medium">Your Agent ID (bytes32)</div>
              <button
                onClick={() => copy(agentIdBytes, "agentIdMain")}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                {copied === "agentIdMain" ? "Copied!" : "Copy"}
              </button>
            </div>
            <code className="text-xs text-zinc-300 break-all font-mono">{agentIdBytes}</code>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function ExportModal({
  contract,
  onClose,
}: {
  contract: ContractData
  onClose: () => void
}) {
  const [format, setFormat] = useState<"json-schema" | "typescript" | "openai">("openai")
  const [loading, setLoading] = useState(false)
  const [exported, setExported] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch("/api/tools/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract: {
            address: contract.address,
            chain: { name: contract.chain },
            functions: contract.functions,
          },
          format,
          descriptions: contract.analysis?.functionDescriptions,
        }),
      })
      const json = await res.json()
      if (json.ok) {
        setExported(JSON.stringify(json.data, null, 2))
      }
    } catch {
      // Handle error silently
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    if (exported) {
      navigator.clipboard.writeText(exported)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleDownload() {
    if (exported) {
      const blob = new Blob([exported], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${contract.address.slice(0, 10)}-tools-${format}.json`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Export Tool Schema</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-zinc-400 mb-2">Export Format</label>
          <div className="flex gap-2">
            {(["openai", "json-schema", "typescript"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFormat(f)
                  setExported(null)
                }}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  format === f
                    ? "bg-amber-500 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {f === "openai" ? "OpenAI Tools" : f === "json-schema" ? "JSON Schema" : "TypeScript"}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-zinc-500 mb-4">
          {format === "openai" && "Export as OpenAI function calling format. Compatible with GPT-4, Claude, and other LLM APIs."}
          {format === "json-schema" && "Export as standard JSON Schema. Universal format for tool definitions."}
          {format === "typescript" && "Export as TypeScript type definitions with function signatures."}
        </p>

        {!exported ? (
          <button
            onClick={handleExport}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-zinc-900 font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? "Exporting..." : "Generate Export"}
          </button>
        ) : (
          <>
            <div className="flex-1 min-h-0 mb-4 overflow-hidden">
              <pre className="bg-zinc-800 rounded-xl p-4 text-sm text-zinc-300 overflow-auto h-full max-h-[40vh] font-mono">
                {exported}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopy}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors"
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold py-3 rounded-xl transition-colors"
              >
                Download JSON
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
