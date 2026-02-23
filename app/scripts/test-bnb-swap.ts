/**
 * Test BNB → USDT swap via LLM Agent
 *
 * Tests swapping native BNB for USDT using the agent
 *
 * Usage:
 *   pnpm tsx scripts/test-bnb-swap.ts
 */

import "dotenv/config"

// BigInt JSON serialization
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { createPublicClient, http, type Abi } from "viem"
import {
  getAgent,
  executeDirectly,
  buildSystemPrompt,
} from "../src/lib/agents/telegram"
import {
  bscTestnet,
  generateExport,
  createAutonomifyTool,
  type UnsignedTransaction,
} from "../src/lib/autonomify-core"

const TEST_AGENT_ID = process.env.TEST_AGENT_ID || "ce062aeb-c83d-4a42-8f15-9c3d369c5bd2"

async function main() {
  console.log("🔄 Testing BNB → USDT Swap via Agent\n")

  // Get the existing agent
  const agent = await getAgent(TEST_AGENT_ID)
  if (!agent) {
    console.error(`❌ Agent ${TEST_AGENT_ID} not found`)
    process.exit(1)
  }

  console.log(`✅ Agent: ${agent.name}`)
  console.log(`   Wallet: ${agent.wallet?.address}`)
  console.log(`   Contracts: ${agent.contracts.length}`)

  if (!agent.wallet) {
    console.error("❌ Agent has no wallet")
    process.exit(1)
  }

  const agentWallet = agent.wallet

  // Build system prompt
  const systemPrompt = buildSystemPrompt(agent)

  // Generate export
  const exportData = generateExport(bscTestnet, agent.contracts)

  // Real signAndSend
  const signAndSend = async (tx: UnsignedTransaction): Promise<`0x${string}`> => {
    console.log(`\n📤 Executing transaction via Privy...`)
    console.log(`   To: ${tx.to}`)
    console.log(`   Data: ${tx.data.slice(0, 66)}...`)
    console.log(`   Value: ${tx.value.toString()} wei`)

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
    agentId: agent.id,
    signAndSend,
  })

  // Test the swap
  const userMessage = "Swap 0.001 BNB for USDT. Execute it now, I confirm."

  console.log("\n" + "=".repeat(70))
  console.log(`👤 User: ${userMessage}`)
  console.log("=".repeat(70))

  const toolCalls: string[] = []

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      prompt: userMessage,
      tools: {
        autonomify_execute: autonomifyTool,
      },
      maxSteps: 5,
      onStepFinish: ({ toolCalls: calls, toolResults }) => {
        for (const call of calls || []) {
          toolCalls.push(`${call.toolName}(${JSON.stringify(call.args, null, 2)})`)
        }
        if (toolResults) {
          for (const r of toolResults) {
            console.log(`\n📊 Tool Result:`, JSON.stringify(r.result, null, 2))
          }
        }
      },
    })

    if (toolCalls.length > 0) {
      console.log(`\n🔧 Tool Calls Made:`)
      for (const call of toolCalls) {
        console.log(call)
      }
    }

    console.log(`\n🤖 Agent Response:`)
    console.log(result.text || "(no text response)")

  } catch (error) {
    console.error(`\n❌ Error: ${(error as Error).message}`)
  }

  console.log("\n✅ Test complete")
}

main().catch(console.error)
