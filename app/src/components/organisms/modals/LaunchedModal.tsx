"use client"

import { useState } from "react"
import type { AgentType } from "@/types"
import { CheckIcon, ShieldIcon } from "@/components/atoms"

interface LaunchedAgent {
  id: string
  name: string
  type: AgentType
  walletAddress?: string
  agentIdBytes?: string
  isNew: boolean
}

interface LaunchedModalProps {
  agent: LaunchedAgent
  onClose: () => void
}

export function LaunchedModal({ agent, onClose }: LaunchedModalProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  if (agent.type === "self_hosted" && agent.isNew) {
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckIcon className="w-8 h-8 text-amber-500" />
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
            <CheckIcon className="w-8 h-8 text-green-500" />
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
                  <ShieldIcon className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
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
              href="https://faucets.chain.link/base-sepolia"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-3 rounded-xl transition-colors mb-3"
            >
              Get testnet ETH &amp; LINK (Chainlink Faucet)
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
