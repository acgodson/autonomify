"use client"

import { useState, useEffect } from "react"
import { AgentTypeBadge } from "@/components/molecules"
import { TerminalIcon, CodeIcon, DownloadIcon, WarningIcon, AlertCircleIcon } from "@/components/atoms"
import type { PolicyData } from "@/types"

interface SelfHostedSetupModalProps {
  agentId: string
  agentName: string
  agentIdBytes: string
  smartAccountAddress: string
  onClose: () => void
}

const KNOWN_ERC20_TOKENS: Record<string, string> = {
  "0xe4ab69c077896252fafbd49efd26b5d171a32410": "LINK",
  "0x4200000000000000000000000000000000000006": "WETH",
}

export function SelfHostedSetupModal({
  agentId,
  agentName,
  agentIdBytes,
  smartAccountAddress,
  onClose,
}: SelfHostedSetupModalProps) {
  const [activeTab, setActiveTab] = useState<"cre" | "sdk">("cre")
  const [sdkFramework, setSdkFramework] = useState<"vercel" | "openai">("vercel")
  const [copied, setCopied] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [policy, setPolicy] = useState<PolicyData | null>(null)
  const [signedDelegation, setSignedDelegation] = useState<string | null>(null)
  const [loadingPolicy, setLoadingPolicy] = useState(true)

  const apiUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/agents/${agentId}/export` : ""

  useEffect(() => {
    async function fetchData() {
      try {
        const policyRes = await fetch(`/api/agents/${agentId}/policy`)
        const policyJson = await policyRes.json()
        if (policyJson.ok && policyJson.data) {
          setPolicy(policyJson.data)
        }

        const delegationRes = await fetch(`/api/delegation`, {
          headers: { "x-user-address": smartAccountAddress },
        })
        const delegationJson = await delegationRes.json()
        if (delegationJson.ok && delegationJson.data?.signedDelegation) {
          setSignedDelegation(delegationJson.data.signedDelegation)
        }
      } catch {
      } finally {
        setLoadingPolicy(false)
      }
    }
    fetchData()
  }, [agentId, smartAccountAddress])

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
    } finally {
      setDownloading(false)
    }
  }

  const targetContract = policy?.whitelistedContracts[0]?.address || ""
  const isKnownERC20 = targetContract.toLowerCase() in KNOWN_ERC20_TOKENS
  const tokenName = isKnownERC20 ? KNOWN_ERC20_TOKENS[targetContract.toLowerCase()] : null

  const maxAmount = policy?.maxTxAmount ? parseFloat(policy.maxTxAmount) : 1
  const testAmount = Math.min(maxAmount * 0.5, 0.1)
  const testAmountWei = BigInt(Math.floor(testAmount * 1e18))
    .toString(16)
    .padStart(64, "0")

  const currentHour = new Date().getUTCHours()
  const isOutsideTimeWindow =
    policy?.enableTimeWindow &&
    (policy.startHour <= policy.endHour
      ? currentHour < policy.startHour || currentHour >= policy.endHour
      : currentHour < policy.startHour && currentHour >= policy.endHour)

  const transferCalldata = `0xa9059cbb000000000000000000000000000000000000000000000000000000000000dead${testAmountWei}`

  const creTestPayload = isKnownERC20
    ? `curl -X POST http://localhost:8080/trigger \\
  -H "Content-Type: application/json" \\
  -d '{
    "userAddress": "${smartAccountAddress}",
    "agentId": "${agentIdBytes}",
    "execution": {
      "target": "${targetContract}",
      "calldata": "${transferCalldata}",
      "value": "0"
    },
    "permissionsContext": "${signedDelegation || "0x"}",
    "simulateOnly": true
  }'`
    : null

  const vercelCode = `import { forVercelAI, buildPrompt } from 'autonomify-sdk'
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import config from './autonomify.json'

const CRE_TRIGGER_URL = process.env.CRE_TRIGGER_URL || 'http://localhost:8080/trigger'
const AGENT_ID = '${agentIdBytes}'
const USER_ADDRESS = '${smartAccountAddress}'
const SIGNED_DELEGATION = '${signedDelegation || "<your-signed-delegation>"}'

// Trigger CRE workflow - no private key needed!
async function triggerCRE(tx, simulateOnly = false) {
  const response = await fetch(CRE_TRIGGER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: USER_ADDRESS,
      agentId: AGENT_ID,
      execution: {
        target: tx.to,
        calldata: tx.data,
        value: tx.value?.toString() || '0',
      },
      permissionsContext: SIGNED_DELEGATION,
      simulateOnly,
    }),
  })
  return response.json()
}

const { tool, simulateTool } = forVercelAI({
  export: config,
  agentId: AGENT_ID,
  submitTx: async (tx) => {
    const result = await triggerCRE(tx, false)
    if (!result.success) throw new Error(result.error?.toString())
    return result.txHash
  },
  simulateTx: async (tx) => {
    const result = await triggerCRE(tx, true)
    return {
      success: result.success,
      wouldSucceed: result.success,
      gasEstimate: result.gasEstimate,
      error: result.error?.recommendation || result.error?.decoded,
    }
  },
})

const { text } = await generateText({
  model: openai('gpt-4o'),
  system: buildPrompt(config),
  tools: {
    autonomify_execute: tool,
    ...(simulateTool && { autonomify_simulate: simulateTool }),
  },
  prompt: 'Simulate transferring 1 LINK to 0x...',
  maxSteps: 5,
})`

  const openaiCode = `import { forOpenAI, buildPrompt } from 'autonomify-sdk'
import OpenAI from 'openai'
import config from './autonomify.json'

const openai = new OpenAI()

const CRE_TRIGGER_URL = process.env.CRE_TRIGGER_URL || 'http://localhost:8080/trigger'
const AGENT_ID = '${agentIdBytes}'
const USER_ADDRESS = '${smartAccountAddress}'
const SIGNED_DELEGATION = '${signedDelegation || "<your-signed-delegation>"}'

// Trigger CRE workflow - no private key needed!
async function triggerCRE(tx, simulateOnly = false) {
  const response = await fetch(CRE_TRIGGER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAddress: USER_ADDRESS,
      agentId: AGENT_ID,
      execution: {
        target: tx.to,
        calldata: tx.data,
        value: tx.value?.toString() || '0',
      },
      permissionsContext: SIGNED_DELEGATION,
      simulateOnly,
    }),
  })
  return response.json()
}

const { tools, handler } = forOpenAI({
  export: config,
  agentId: AGENT_ID,
  submitTx: async (tx) => {
    const result = await triggerCRE(tx, false)
    if (!result.success) throw new Error(result.error?.toString())
    return result.txHash
  },
  simulateTx: async (tx) => {
    const result = await triggerCRE(tx, true)
    return {
      success: result.success,
      wouldSucceed: result.success,
      gasEstimate: result.gasEstimate,
      error: result.error?.recommendation || result.error?.decoded,
    }
  },
})

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: buildPrompt(config) },
    { role: 'user', content: 'Simulate transferring 1 LINK to 0x...' },
  ],
  tools,
})

for (const toolCall of response.choices[0].message.tool_calls || []) {
  const result = await handler(toolCall)
  console.log(result)
}`

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-2xl max-h-[85vh] flex flex-col">
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

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab("cre")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "cre"
                  ? "bg-amber-500 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <TerminalIcon className="w-4 h-4" />
              CRE Test
            </button>
            <button
              onClick={() => setActiveTab("sdk")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === "sdk"
                  ? "bg-amber-500 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:text-white"
              }`}
            >
              <CodeIcon className="w-4 h-4" />
              SDK Setup
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "cre" ? (
            <div className="space-y-6">
              {loadingPolicy ? (
                <div className="text-center py-8 text-zinc-500">Loading policy...</div>
              ) : !isKnownERC20 ? (
                <div className="space-y-6">
                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6 text-center">
                    <div className="w-12 h-12 bg-zinc-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <WarningIcon className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div className="text-white font-medium mb-2">Test Payload Not Available</div>
                    <div className="text-sm text-zinc-400 mb-4">
                      Auto-generated test payloads are only available for known ERC20 tokens (LINK,
                      WETH). Your contract requires a custom calldata payload.
                    </div>
                    <div className="bg-zinc-900 rounded-lg p-3 text-left">
                      <div className="text-xs text-zinc-500 mb-1">Whitelisted Contract</div>
                      <code className="text-xs text-zinc-400 break-all">
                        {targetContract || "None"}
                      </code>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm text-zinc-400 font-medium">Your agent parameters:</div>
                    <div className="grid gap-2">
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="text-xs text-zinc-500">Smart Account</div>
                        <code className="text-xs text-blue-400 break-all">{smartAccountAddress}</code>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="text-xs text-zinc-500">Agent ID (bytes32)</div>
                        <code className="text-xs text-amber-400 break-all">{agentIdBytes}</code>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-900/20 border border-amber-800/50 rounded-xl p-4">
                    <div className="text-sm text-amber-400 font-medium mb-2">
                      To test this agent:
                    </div>
                    <div className="text-xs text-zinc-400">
                      Use the <span className="text-white">SDK Setup</span> tab to integrate with
                      your AI framework, or construct a custom curl payload with the correct calldata
                      for your contract&apos;s functions.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {isOutsideTimeWindow && (
                    <div className="bg-red-900/30 border border-red-800 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <WarningIcon className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-sm text-red-400 font-medium">Outside Time Window</div>
                          <div className="text-xs text-zinc-400 mt-1">
                            Policy allows execution {policy?.startHour}:00 - {policy?.endHour}:00
                            UTC. Current time: {currentHour}:00 UTC. Test will fail ZK proof
                            generation.
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 border border-blue-500/40 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                        <TerminalIcon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <div className="text-white font-semibold">Test CRE Workflow Locally</div>
                        <div className="text-sm text-zinc-400">
                          {tokenName} transfer to dead address • Run against your local CRE
                        </div>
                      </div>
                    </div>
                    {!signedDelegation && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3">
                        <div className="flex items-center gap-2 text-red-400 text-sm">
                          <AlertCircleIcon className="w-4 h-4" />
                          No delegation found. Sign a delegation first for real execution to work.
                        </div>
                      </div>
                    )}
                    <div className="relative">
                      <pre className="bg-zinc-900 rounded-lg p-4 text-cyan-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                        {creTestPayload}
                      </pre>
                      <button
                        onClick={() => copy(creTestPayload!, "cre")}
                        className="absolute top-2 right-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-medium"
                      >
                        {copied === "cre" ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm text-zinc-400 font-medium">
                      Test parameters (from your policy):
                    </div>
                    <div className="grid gap-2">
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="text-xs text-zinc-500">Smart Account</div>
                        <code className="text-xs text-blue-400 break-all">{smartAccountAddress}</code>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="text-xs text-zinc-500">Agent ID (bytes32)</div>
                        <code className="text-xs text-amber-400 break-all">{agentIdBytes}</code>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3">
                        <div className="text-xs text-zinc-500">Target Contract</div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-green-400 break-all">{targetContract}</code>
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                            {tokenName}
                          </span>
                        </div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-3 flex justify-between items-center">
                        <div>
                          <div className="text-xs text-zinc-500">Test Amount</div>
                          <code className="text-xs text-white">{testAmount.toFixed(4)} ETH</code>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Max Allowed</div>
                          <code className="text-xs text-green-400">
                            {policy?.maxTxAmount || "1"} ETH
                          </code>
                        </div>
                      </div>
                      {policy?.enableTimeWindow && (
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                          <div className="text-xs text-zinc-500">Time Window (UTC)</div>
                          <code className="text-xs text-white">
                            {policy.startHour}:00 - {policy.endHour}:00
                          </code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 space-y-2">
                    <div className="text-sm text-zinc-300 font-medium">Test modes:</div>
                    <div className="text-sm text-zinc-400">
                      <span className="text-green-400">simulateOnly: true</span> - Runs on Tenderly
                      Virtual TestNet (no delegation needed)
                    </div>
                    <div className="text-sm text-zinc-400">
                      <span className="text-amber-400">simulateOnly: false</span> - Real on-chain
                      execution (requires signed delegation)
                    </div>
                  </div>

                  <a
                    href="https://faucets.chain.link/base-sepolia"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 py-3 rounded-xl transition-colors"
                  >
                    Get testnet ETH &amp; {tokenName} (Chainlink Faucet)
                  </a>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-xs font-bold text-zinc-900">
                    1
                  </div>
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
                  <DownloadIcon className="w-5 h-5" />
                  {downloading ? "Downloading..." : "Download autonomify.json"}
                </button>
              </div>

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 bg-zinc-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    2
                  </div>
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

              <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-6 h-6 bg-zinc-600 rounded-full flex items-center justify-center text-xs font-bold text-white">
                    3
                  </div>
                  <div className="font-medium text-white">Integrate</div>
                </div>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setSdkFramework("vercel")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      sdkFramework === "vercel"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-800 text-zinc-500 hover:text-white"
                    }`}
                  >
                    Vercel AI SDK
                  </button>
                  <button
                    onClick={() => setSdkFramework("openai")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      sdkFramework === "openai"
                        ? "bg-zinc-700 text-white"
                        : "bg-zinc-800 text-zinc-500 hover:text-white"
                    }`}
                  >
                    OpenAI SDK
                  </button>
                </div>

                <div className="relative">
                  <pre className="bg-zinc-900 rounded-lg p-4 text-zinc-300 font-mono text-xs overflow-x-auto max-h-64">
                    {sdkFramework === "vercel" ? vercelCode : openaiCode}
                  </pre>
                  <button
                    onClick={() =>
                      copy(sdkFramework === "vercel" ? vercelCode : openaiCode, "code")
                    }
                    className="absolute top-2 right-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded text-xs"
                  >
                    {copied === "code" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}

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
