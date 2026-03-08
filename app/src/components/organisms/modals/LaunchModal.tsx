"use client"

import { useState } from "react"
import type { AgentType, AgentData, ContractData } from "@/types"
import { MagicWandIcon, TelegramIcon, DiscordIcon, CodeIcon, ShieldIcon } from "@/components/atoms"

interface LaunchModalProps {
  contract: ContractData
  agents: AgentData[]
  ownerAddress: string
  onClose: () => void
  onLaunched: (agent: {
    id: string
    name: string
    type: AgentType
    walletAddress?: string
    agentIdBytes?: string
    isNew: boolean
  }) => void
}

export function LaunchModal({
  contract,
  agents,
  ownerAddress,
  onClose,
  onLaunched,
}: LaunchModalProps) {
  const [step, setStep] = useState<"type" | "config">("type")
  const [agentType, setAgentType] = useState<AgentType>("telegram")
  const [mode, setMode] = useState<"new" | "existing">("new")
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [maxTxAmount, setMaxTxAmount] = useState("0.1")
  const [enableTimeWindow, setEnableTimeWindow] = useState(false)
  const [startHour, setStartHour] = useState(9)
  const [endHour, setEndHour] = useState(17)

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
          body: JSON.stringify({ chainId: contract.chainId, address: contract.address }),
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

        const body: Record<string, unknown> = {
          name: name.trim(),
          type: agentType,
          ownerAddress,
          policy: {
            maxTxAmount: maxTxAmount,
            enableTimeWindow: enableTimeWindow,
            startHour: enableTimeWindow ? startHour : 0,
            endHour: enableTimeWindow ? endHour : 24,
            whitelistedContract: contract.address,
          },
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
          body: JSON.stringify({ chainId: contract.chainId, address: contract.address }),
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
            <button
              onClick={() => handleSelectType("telegram")}
              className="w-full flex items-center gap-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-[#0088cc] rounded-xl flex items-center justify-center flex-shrink-0">
                <TelegramIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Telegram Bot</div>
                <div className="text-sm text-zinc-400">Hosted agent with Privy wallet</div>
              </div>
              <span className="text-zinc-500">→</span>
            </button>

            <button
              disabled
              className="w-full flex items-center gap-4 bg-zinc-800/50 rounded-xl p-4 text-left cursor-not-allowed relative overflow-hidden"
            >
              <div className="w-12 h-12 bg-[#5865F2]/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <DiscordIcon className="w-6 h-6 text-white/50" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-zinc-500">Discord Bot</div>
                <div className="text-sm text-zinc-600">Coming soon</div>
              </div>
              <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-1 rounded-full">Soon</span>
            </button>

            <button
              onClick={() => handleSelectType("self_hosted")}
              className="w-full flex items-center gap-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl p-4 transition-colors text-left"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <CodeIcon className="w-6 h-6 text-white" />
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

                <div className="pt-4 border-t border-zinc-800 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldIcon className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium text-zinc-300">Policy Limits</span>
                  </div>

                  <div className="bg-zinc-800/50 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1">Whitelisted Contract</div>
                    <code className="text-xs text-green-400">{contract.address}</code>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Max per transaction (ETH)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={maxTxAmount}
                      onChange={(e) => setMaxTxAmount(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="enableTimeWindow"
                        checked={enableTimeWindow}
                        onChange={(e) => setEnableTimeWindow(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-green-500 focus:ring-green-500"
                      />
                      <label htmlFor="enableTimeWindow" className="text-xs text-zinc-400">
                        Restrict to operating hours
                      </label>
                    </div>
                    {enableTimeWindow && (
                      <div className="flex items-center gap-2 pl-6">
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={startHour}
                          onChange={(e) => setStartHour(parseInt(e.target.value) || 0)}
                          className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm text-center"
                        />
                        <span className="text-xs text-zinc-500">to</span>
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={endHour}
                          onChange={(e) => setEndHour(parseInt(e.target.value) || 0)}
                          className="w-16 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-white text-sm text-center"
                        />
                        <span className="text-xs text-zinc-500">UTC</span>
                      </div>
                    )}
                  </div>
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
