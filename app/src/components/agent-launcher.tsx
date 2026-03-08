"use client"

import { useState } from "react"
import { useWallet } from "@/lib/wallet/hooks"

interface CreatedAgent {
  id: string
  name: string
  ownerAddress: string
}

interface AgentLauncherProps {
  onAgentCreated: (agent: CreatedAgent) => void
}

export function AgentLauncher({ onAgentCreated }: AgentLauncherProps) {
  const { address } = useWallet()
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!address) {
      setError("Connect wallet first")
      return
    }
    if (!name.trim()) {
      setError("Enter agent name")
      return
    }
    if (!token.trim()) {
      setError("Enter Telegram bot token")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          telegramBotToken: token.trim(),
          ownerAddress: address,
        }),
      })

      const json = await res.json()

      if (!json.ok) {
        setError(json.error || "Failed to create agent")
        return
      }

      onAgentCreated({
        id: json.data.id,
        name: json.data.name,
        ownerAddress: json.data.ownerAddress,
      })

      setName("")
      setToken("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Agent name (e.g., My Trading Bot)"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Telegram bot token from @BotFather"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
        />

        <button
          onClick={handleCreate}
          disabled={loading || !address}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          {loading ? "Creating..." : "Create Agent"}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <p className="text-zinc-500 text-sm">
        Get a bot token from{" "}
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          @BotFather
        </a>{" "}
        on Telegram
      </p>
    </div>
  )
}

interface AgentCardProps {
  agent: CreatedAgent
}

export function AgentCard({ agent }: AgentCardProps) {
  const [copied, setCopied] = useState(false)

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{agent.name}</h3>
        <span className="text-xs text-zinc-500">{agent.id.slice(0, 8)}...</span>
      </div>

      <div className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
        <div>
          <div className="text-zinc-500 text-xs">Owner</div>
          <code className="text-sm text-blue-400">
            {agent.ownerAddress.slice(0, 6)}...{agent.ownerAddress.slice(-4)}
          </code>
        </div>
        <button
          onClick={() => copyToClipboard(agent.ownerAddress)}
          className="text-zinc-500 hover:text-white text-sm"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <div className="text-zinc-500 text-sm">
        Agent executes via your delegated Smart Account using Chainlink CRE.
      </div>
    </div>
  )
}
