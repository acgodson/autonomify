"use client"

import { useState, useEffect } from "react"
import { FunctionList } from "@/components/function-list"
import type { FunctionInfo } from "@/lib/types"

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

interface AgentData {
  id: string
  name: string
  walletAddress: string
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
  const [launchedAgent, setLaunchedAgent] = useState<{
    id: string
    name: string
    walletAddress: string
    walletPrivateKey: string
  } | null>(null)

  const [address, setAddress] = useState("")
  const [chain, setChain] = useState("bscTestnet")
  const [loading, setLoading] = useState(false)
  const [loadingWordIndex, setLoadingWordIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

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
            <MagicWandIcon className="w-5 h-5 text-amber-400" />
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
        <div className="text-center mb-10">
          <p className="text-zinc-300 text-xl">
            Turn any <span className="gradient-text">verified contract</span> into a{" "}
            <span className="relative inline-block">
              Telegram agent
              <MagicUnderline />
            </span>
            {" "}and <span className="text-zinc-500">more..</span>
          </p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-8">
          <div className="flex gap-3">
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-4 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-lg"
              onKeyDown={(e) => e.key === "Enter" && handleAutonomify()}
            />

            <button
              onClick={handleAutonomify}
              disabled={loading}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-semibold px-8 py-4 rounded-xl transition-all text-lg"
            >
              <MagicWandIcon className="w-5 h-5" />
              {loading ? "..." : "Autonomify"}
            </button>
          </div>

          {loading && (
            <div className="mt-4 flex justify-center">
              <LoadingAnimation word={LOADING_WORDS[loadingWordIndex]} />
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}
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
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setShowLaunchModal(true)}
                  className="flex items-center justify-center gap-3 bg-[#0088cc] hover:bg-[#0099dd] text-white font-medium py-4 px-6 rounded-xl transition-colors"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.65-2.89 7.99-3.45 3.8-1.6 4.59-1.88 5.1-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                  </svg>
                  Telegram
                </button>

                <button
                  disabled
                  className="flex items-center justify-center gap-3 bg-zinc-800 text-zinc-500 font-medium py-4 px-6 rounded-xl cursor-not-allowed"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X (Coming Soon)
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <button className="text-zinc-500 hover:text-zinc-300 text-sm">
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
            className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto"
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
                  className="bg-zinc-800 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span className="font-medium">{agent.name}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mb-1">
                    {agent.contractCount} contract{agent.contractCount !== 1 ? "s" : ""}
                  </div>
                  <code className="text-xs text-zinc-400 break-all">
                    {agent.walletAddress}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
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
                  walletAddress: agent.walletAddress,
                  contractCount: 1,
                },
              ]
            })
            setShowLaunchModal(false)
          }}
        />
      )}

      {launchedAgent && (
        <LaunchedModal
          agent={launchedAgent}
          onClose={() => setLaunchedAgent(null)}
        />
      )}
    </main>
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
    walletAddress: string
    walletPrivateKey: string
  }) => void
}) {
  const [mode, setMode] = useState<"new" | "existing">(agents.length > 0 ? "existing" : "new")
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id || "")
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          walletAddress: agent.walletAddress,
          walletPrivateKey: "",
        })
      } else {
        if (!name.trim() || !token.trim()) {
          setError("Fill in all fields")
          return
        }

        const agentRes = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), telegramBotToken: token.trim() }),
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

        await fetch(`/api/agents/${agentJson.data.id}/webhook`, {
          method: "POST",
        })

        onLaunched({
          id: agentJson.data.id,
          name: agentJson.data.name,
          walletAddress: agentJson.data.walletAddress,
          walletPrivateKey: agentJson.data.walletPrivateKey,
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
          <h2 className="text-xl font-semibold">Launch Telegram Agent</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        {agents.length > 0 && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMode("existing")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "existing"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Add to Existing
            </button>
            <button
              onClick={() => setMode("new")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "new"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              Create New
            </button>
          </div>
        )}

        <div className="space-y-4">
          {mode === "existing" ? (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">Select Agent</label>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {agents.map((agent) => (
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
                  placeholder="My Token Agent"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

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
            className="w-full bg-[#0088cc] hover:bg-[#0099dd] disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors"
          >
            {loading ? "Launching..." : mode === "existing" ? "Add Contract" : "Launch Agent"}
          </button>
        </div>
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
    walletAddress: string
    walletPrivateKey: string
  }
  onClose: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const isExisting = !agent.walletPrivateKey

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
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
            {isExisting ? "Contract Added!" : `${agent.name} Launched!`}
          </h2>
          <p className="text-zinc-400 text-sm mt-1">
            {isExisting ? `Added to ${agent.name}` : "Your agent wallet is ready"}
          </p>
        </div>

        {!isExisting && (
          <>
            <div className="space-y-3 mb-6">
              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Wallet Address</div>
                    <code className="text-sm text-blue-400">{agent.walletAddress}</code>
                  </div>
                  <button
                    onClick={() => copy(agent.walletAddress, "address")}
                    className="text-zinc-500 hover:text-white text-sm"
                  >
                    {copied === "address" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Private Key</div>
                    <code className="text-sm text-yellow-400">
                      {agent.walletPrivateKey.slice(0, 10)}...
                    </code>
                  </div>
                  <button
                    onClick={() => copy(agent.walletPrivateKey, "key")}
                    className="text-zinc-500 hover:text-white text-sm"
                  >
                    {copied === "key" ? "Copied!" : "Copy"}
                  </button>
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
