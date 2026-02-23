/**
 * Test Multi-Contract Agent with PancakeSwap + USDT
 *
 * Tests the full LLM flow:
 * 1. Agent has both USDT and PancakeSwap Router
 * 2. User asks for swap quote (FREE)
 * 3. User asks to execute swap (WRITE)
 *
 * Usage:
 *   pnpm tsx scripts/test-multi-contract-agent.ts
 */

import "dotenv/config"

// BigInt JSON serialization
;(BigInt.prototype as any).toJSON = function () {
  return this.toString()
}

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { type Abi } from "viem"
import {
  bscTestnet,
  generateExport,
  createAutonomifyTool,
  fetchAbi,
  extractFunctions,
  resolveMetadata,
  type UnsignedTransaction,
} from "../src/lib/autonomify-core"
import type { ContractContext } from "../src/lib/autonomify-core/types"
import { buildSystemPrompt } from "../src/lib/agents/telegram/prompt"
import { executeDirectly, getAgent } from "../src/lib/agents/telegram"
import type { AgentConfig } from "../src/lib/agents/telegram/types"

// Contract addresses
const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as const
const PANCAKE_ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" as const
const WBNB_ADDRESS = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as const

// Use existing agent for real execution
const TEST_AGENT_ID = process.env.TEST_AGENT_ID || "ce062aeb-c83d-4a42-8f15-9c3d369c5bd2"

async function resolveContract(address: `0x${string}`): Promise<ContractContext> {
  console.log(`   Fetching ABI for ${address.slice(0, 10)}...`)
  const { abi } = await fetchAbi(bscTestnet, address)

  console.log(`   Resolving metadata...`)
  const metadata = await resolveMetadata(bscTestnet, address, abi as Abi)

  console.log(`   Extracting functions...`)
  const functions = extractFunctions(abi as Abi)

  return {
    address,
    chain: bscTestnet,
    abi: abi as Abi,
    metadata,
    functions,
  }
}

async function main() {
  console.log("🧪 Testing Multi-Contract Agent (USDT + PancakeSwap)\n")

  // Step 1: Try to get existing agent or build mock one
  console.log(`📦 Getting agent ${TEST_AGENT_ID}...`)
  let agent = await getAgent(TEST_AGENT_ID)

  let useRealExecution = false
  let agentWallet: { address: string; privyWalletId: string } | null = null

  if (agent && agent.wallet) {
    console.log(`✅ Found agent: ${agent.name}`)
    console.log(`   Wallet: ${agent.wallet.address}`)
    console.log(`   Contracts: ${agent.contracts.length}`)
    agentWallet = agent.wallet
    useRealExecution = true
  } else {
    console.log(`⚠️ Agent not found or has no wallet. Using mock mode.`)
    console.log(`   To use real execution, set TEST_AGENT_ID env var.`)
  }

  // Step 2: Resolve both contracts
  console.log("\n📦 Resolving contracts...")

  console.log("\n1. USDT Token:")
  const usdtContract = await resolveContract(USDT_ADDRESS)
  console.log(`   ✅ ${usdtContract.metadata.name} - ${usdtContract.functions.length} functions`)

  console.log("\n2. PancakeSwap Router:")
  const pancakeContract = await resolveContract(PANCAKE_ROUTER)
  console.log(`   ✅ ${pancakeContract.metadata.name || "PancakeRouter"} - ${pancakeContract.functions.length} functions`)

  // Step 3: Generate export with BOTH contracts
  console.log("\n📤 Generating multi-contract export...")
  const contracts = [usdtContract, pancakeContract]
  const exportData = generateExport(bscTestnet, contracts)
  console.log(`   ✅ Export has ${Object.keys(exportData.contracts).length} contracts`)

  // Step 4: Create the tool with real or mock execution
  const signAndSend = async (tx: UnsignedTransaction): Promise<`0x${string}`> => {
    if (useRealExecution && agentWallet) {
      console.log(`\n📤 Executing REAL transaction via Privy...`)
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
    } else {
      console.log(`\n📤 [MOCK] Would execute transaction:`)
      console.log(`   To: ${tx.to}`)
      console.log(`   Data: ${tx.data.slice(0, 66)}...`)
      console.log(`   Value: ${tx.value.toString()} wei`)
      // Return mock hash
      return "0x" + "a".repeat(64) as `0x${string}`
    }
  }

  const autonomifyTool = createAutonomifyTool({
    export: exportData,
    agentId: TEST_AGENT_ID,
    signAndSend,
  })

  // Step 5: Build system prompt using real prompt builder
  // Build a mock agent config for the prompt
  const mockAgent: AgentConfig = {
    id: TEST_AGENT_ID,
    name: "DeFi Assistant",
    type: "telegram",
    wallet: agentWallet ? {
      address: agentWallet.address as `0x${string}`,
      privyWalletId: agentWallet.privyWalletId,
    } : {
      address: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      privyWalletId: "mock-wallet-id",
    },
    contracts: contracts.map((c) => ({
      address: c.address as `0x${string}`,
      chainId: c.chain.id.toString(),
      chainConfig: c.chain,
      abi: c.abi,
      metadata: c.metadata,
      functions: c.functions,
    })),
    createdAt: new Date(),
  }

  const systemPrompt = buildSystemPrompt(mockAgent)
  console.log("\n📜 System prompt built with token registry")
  console.log("   Preview (first 800 chars):")
  console.log(systemPrompt.slice(0, 800) + "...\n")

  // Step 6: Test conversations
  const testConversations = [
    // Test: Swap BNB for USDT
    "Swap 0.001 BNB for USDT. Execute it now, I confirm.",
  ]

  for (const userMessage of testConversations) {
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
            for (const result of toolResults) {
              console.log(`\n📊 Tool Result:`, JSON.stringify(result.result, null, 2))
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
  }

  console.log("\n" + "=".repeat(70))
  console.log("✅ Multi-contract agent test complete")
  console.log("=".repeat(70))
}

main().catch(console.error)
