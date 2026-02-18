"use client"

import { useState } from "react"

interface CreatedAgent {
  id: string
  name: string
  walletAddress: string
  walletPrivateKey: string
}

interface AgentLauncherProps {
  onAgentCreated: (agent: CreatedAgent) => void
}

export function AgentLauncher({ onAgentCreated }: AgentLauncherProps) {
  const [name, setName] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
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
        body: JSON.stringify({ name: name.trim(), telegramBotToken: token.trim() }),
      })

      const json = await res.json()

      if (!json.ok) {
        setError(json.error || "Failed to create agent")
        return
      }

      onAgentCreated({
        id: json.data.id,
        name: json.data.name,
        walletAddress: json.data.walletAddress,
        walletPrivateKey: json.data.walletPrivateKey,
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
          placeholder="Agent name (e.g., My Token Agent)"
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
          disabled={loading}
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
  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{agent.name}</h3>
        <span className="text-xs text-zinc-500">{agent.id}</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
          <div>
            <div className="text-zinc-500 text-xs">Wallet Address</div>
            <code className="text-sm text-blue-400">{agent.walletAddress}</code>
          </div>
          <button
            onClick={() => copyToClipboard(agent.walletAddress, "address")}
            className="text-zinc-500 hover:text-white text-sm"
          >
            {copied === "address" ? "Copied!" : "Copy"}
          </button>
        </div>

        <div className="flex items-center justify-between bg-zinc-900 rounded px-3 py-2">
          <div>
            <div className="text-zinc-500 text-xs">Private Key</div>
            <code className="text-sm text-yellow-400">
              {agent.walletPrivateKey.slice(0, 10)}...{agent.walletPrivateKey.slice(-8)}
            </code>
          </div>
          <button
            onClick={() => copyToClipboard(agent.walletPrivateKey, "key")}
            className="text-zinc-500 hover:text-white text-sm"
          >
            {copied === "key" ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <a
        href="https://www.bnbchain.org/en/testnet-faucet"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 text-sm py-2 rounded-lg transition-colors"
      >
        Get testnet BNB from faucet
      </a>
    </div>
  )
}
