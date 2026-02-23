/**
 * Test Agent Prompt & LLM Integration
 *
 * Tests the Telegram agent prompt without needing actual Telegram.
 * Verifies the agent is self-aware and understands its capabilities.
 *
 * Usage:
 *   pnpm tsx scripts/test-prompt.ts
 */

import "dotenv/config"

// Add BigInt JSON serialization support
;(BigInt.prototype as any).toJSON = function() {
  return this.toString()
}
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import {
  getAgent,
  getNativeBalance,
  executeDirectly,
  buildSystemPrompt,
  type AgentConfig,
} from "../src/lib/agents/telegram"
import {
  bscTestnet,
  generateExport,
  createAutonomifyTool,
  type UnsignedTransaction,
} from "../src/lib/autonomify-core"

const TEST_AGENT_ID = process.env.TEST_AGENT_ID || "ce062aeb-c83d-4a42-8f15-9c3d369c5bd2"

async function processWithLLM(
  agent: AgentConfig,
  userMessage: string
): Promise<{ response: string; toolCalls: string[] }> {
  if (!agent.wallet) throw new Error("Agent wallet required")
  const agentWallet = agent.wallet

  const systemPrompt = buildSystemPrompt(agent)
  console.log("\n📜 System Prompt Preview (first 500 chars):")
  console.log(systemPrompt.slice(0, 500) + "...\n")

  const exportData = generateExport(bscTestnet, agent.contracts)

  // Real signAndSend using Privy!
  const signAndSend = async (tx: UnsignedTransaction): Promise<`0x${string}`> => {
    console.log(`\n📤 Executing transaction via Privy...`)
    console.log(`   To: ${tx.to}`)
    console.log(`   Data: ${tx.data.slice(0, 66)}...`)
    console.log(`   Value: ${tx.value.toString()}`)

    try {
      const result = await executeDirectly({
        walletId: agentWallet.privyWalletId,
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })

      console.log(`✅ Tx hash: ${result.hash}`)
      console.log(`🔗 https://testnet.bscscan.com/tx/${result.hash}`)

      return result.hash as `0x${string}`
    } catch (error) {
      console.error(`❌ Privy error:`, error)
      throw error
    }
  }

  const autonomifyTool = createAutonomifyTool({
    export: exportData,
    agentId: agent.id,  // UUID will be converted to bytes32
    signAndSend,
  })

  const toolCalls: string[] = []

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    prompt: userMessage,
    tools: {
      autonomify_execute: autonomifyTool,
      // Note: Removed simulate tool - it fails with "approve from zero address"
      // because simulation doesn't have a caller context
    },
    maxSteps: 5,
    onStepFinish: ({ toolCalls: calls }) => {
      for (const call of calls || []) {
        toolCalls.push(`${call.toolName}(${JSON.stringify(call.args)})`)
      }
    },
  })

  return { response: result.text || "No response", toolCalls }
}

async function main() {
  console.log("🧪 Testing Agent Prompt & LLM Integration\n")

  const agent = await getAgent(TEST_AGENT_ID)
  if (!agent) {
    console.error(`❌ Agent ${TEST_AGENT_ID} not found`)
    console.log("Create one first: curl -X POST http://localhost:3001/api/agents ...")
    process.exit(1)
  }

  console.log(`✅ Agent: ${agent.name}`)
  console.log(`   Wallet: ${agent.wallet?.address}`)
  console.log(`   Contracts: ${agent.contracts.length}`)

  const testMessages = [
    // Use executor address as spender - add "yes" confirmation inline
    "Call autonomify_execute with contractAddress=0x337610d27c682E347C9cD60BD4b3b107C9d34dDd, functionName=approve, args=['0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C', '100000000000000000000']. I confirm yes, execute now.",
  ]

  for (const msg of testMessages) {
    console.log("\n" + "=".repeat(60))
    console.log(`👤 User: ${msg}`)
    console.log("=".repeat(60))

    try {
      const { response, toolCalls } = await processWithLLM(agent, msg)

      if (toolCalls.length > 0) {
        console.log(`\n🔧 Tool Calls:`)
        for (const call of toolCalls) {
          console.log(`   - ${call}`)
        }
      }

      console.log(`\n🤖 Agent: ${response}`)
    } catch (err) {
      console.error(`❌ Error: ${(err as Error).message}`)
    }
  }

  console.log("\n✅ Test complete")
}

main().catch(console.error)
