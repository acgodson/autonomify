"use client"

import { useState, useEffect } from "react"
import type { AgentData, PolicyData } from "@/types"
import { AgentTypeBadge } from "@/components/molecules"
import { CodeIcon, EditIcon } from "@/components/atoms"

interface AgentDetailModalProps {
  agent: AgentData
  onClose: () => void
  onOpenSetup: () => void
}

export function AgentDetailModal({ agent, onClose, onOpenSetup }: AgentDetailModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"details" | "policy">("details")
  const [policy, setPolicy] = useState<PolicyData | null>(null)
  const [loadingPolicy, setLoadingPolicy] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [editForm, setEditForm] = useState({
    maxTxAmount: "",
    enableTimeWindow: false,
    startHour: 9,
    endHour: 17,
  })

  useEffect(() => {
    if (activeTab === "policy" && !policy && !loadingPolicy) {
      setLoadingPolicy(true)
      fetch(`/api/agents/${agent.id}/policy`)
        .then((res) => res.json())
        .then((json) => {
          if (json.ok && json.data) {
            setPolicy(json.data)
            setEditForm({
              maxTxAmount: json.data.maxTxAmount,
              enableTimeWindow: json.data.enableTimeWindow,
              startHour: json.data.startHour,
              endHour: json.data.endHour,
            })
          }
        })
        .finally(() => setLoadingPolicy(false))
    }
  }, [activeTab, agent.id, policy, loadingPolicy])

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  async function savePolicy() {
    setSavingPolicy(true)
    try {
      const res = await fetch(`/api/agents/${agent.id}/policy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const json = await res.json()
      if (json.ok) {
        setPolicy(json.data)
        setEditingPolicy(false)
      }
    } finally {
      setSavingPolicy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <h2 className="text-xl font-semibold">{agent.name}</h2>
            <AgentTypeBadge type={agent.type} size="md" />
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab("details")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "details"
                ? "bg-amber-500 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("policy")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === "policy"
                ? "bg-amber-500 text-zinc-900"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
          >
            Policy
          </button>
        </div>

        {activeTab === "details" && (
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
                <CodeIcon className="w-5 h-5" />
                View Setup Instructions
              </button>
            )}

            {agent.walletAddress && (
              <a
                href="https://faucets.chain.link/base-sepolia"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-3 rounded-xl transition-colors"
              >
                Get testnet ETH &amp; LINK (Chainlink Faucet)
              </a>
            )}
          </div>
        )}

        {activeTab === "policy" && (
          <div className="space-y-4">
            {loadingPolicy ? (
              <div className="text-center py-8 text-zinc-500">Loading policy...</div>
            ) : !policy ? (
              <div className="text-center py-8 text-zinc-500">No policy configured</div>
            ) : editingPolicy ? (
              <>
                <div className="bg-zinc-800 rounded-xl p-4">
                  <label className="text-xs text-zinc-500 block mb-2">Max Transaction Amount (tokens)</label>
                  <input
                    type="text"
                    value={editForm.maxTxAmount}
                    onChange={(e) => setEditForm({ ...editForm, maxTxAmount: e.target.value })}
                    className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div className="bg-zinc-800 rounded-xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.enableTimeWindow}
                      onChange={(e) => setEditForm({ ...editForm, enableTimeWindow: e.target.checked })}
                      className="w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-white">Enable Time Window</span>
                  </label>

                  {editForm.enableTimeWindow && (
                    <div className="mt-3 flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs text-zinc-500 block mb-1">Start Hour (UTC)</label>
                        <select
                          value={editForm.startHour}
                          onChange={(e) => setEditForm({ ...editForm, startHour: Number(e.target.value) })}
                          className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-white"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-zinc-500 block mb-1">End Hour (UTC)</label>
                        <select
                          value={editForm.endHour}
                          onChange={(e) => setEditForm({ ...editForm, endHour: Number(e.target.value) })}
                          className="w-full bg-zinc-700 rounded-lg px-3 py-2 text-white"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i}>{i.toString().padStart(2, "0")}:00</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingPolicy(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePolicy}
                    disabled={savingPolicy}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-900 font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {savingPolicy ? "Saving..." : "Save Policy"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-zinc-500">Sync Status</div>
                    <div className={`text-xs px-2 py-1 rounded ${
                      policy.syncStatus === "synced" ? "bg-green-500/20 text-green-400" :
                      policy.syncStatus === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                      "bg-red-500/20 text-red-400"
                    }`}>
                      {policy.syncStatus}
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="text-xs text-zinc-500 mb-1">Max Transaction Amount</div>
                  <div className="text-white font-medium">{policy.maxTxAmount} tokens</div>
                </div>

                <div className="bg-zinc-800 rounded-xl p-4">
                  <div className="text-xs text-zinc-500 mb-1">Time Window</div>
                  <div className="text-white font-medium">
                    {policy.enableTimeWindow
                      ? `${policy.startHour.toString().padStart(2, "0")}:00 - ${policy.endHour.toString().padStart(2, "0")}:00 UTC`
                      : "Disabled (24/7)"}
                  </div>
                </div>

                {policy.whitelistedContracts.length > 0 && (
                  <div className="bg-zinc-800 rounded-xl p-4">
                    <div className="text-xs text-zinc-500 mb-2">Whitelisted Contracts</div>
                    <div className="space-y-2">
                      {policy.whitelistedContracts.map((c) => (
                        <div key={c.address} className="text-sm">
                          <div className="text-zinc-400">{c.name || c.address.slice(0, 10)}</div>
                          <code className="text-xs text-blue-400 break-all">{c.address}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setEditingPolicy(true)}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <EditIcon className="w-4 h-4" />
                  Edit Policy
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
