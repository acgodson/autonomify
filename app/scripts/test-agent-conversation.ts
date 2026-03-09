/**
 * Test Harness for Agent Conversations
 *
 * This script simulates conversations with the agent's LLM
 * without going through Telegram. It uses the same tools,
 * prompt, and context that the real agent would use.
 *
 * Usage:
 *   pnpm tsx scripts/test-agent-conversation.ts [options] [scenario]
 *
 * Options:
 *   --agent=<id>      Agent ID (UUID) - defaults to first agent
 *   --verbose         Show detailed output including tool internals
 *   --quiet           Minimal output, just pass/fail
 *   --list            List available scenarios and exit
 *
 * Scenarios (partial match supported):
 *   "Intro"           Introduction scenarios
 *   "balance"         Balance check scenarios
 *   "transfer"        Transfer scenarios
 *   "E2E"             End-to-end with confirmation
 *   "quote"           DEX quote scenarios
 *   "simulate"        Simulation scenarios
 */

import "dotenv/config"
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import {
  createPublicClient,
  http,
  encodeFunctionData,
  formatUnits,
  getAddress,
  type Abi,
} from "viem"
import { db } from "../src/lib/db"
import { agents, agentContracts, delegations } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  buildPrompt,
  getChainOrThrow,
  getBestRpcUrl,
  isReadOnly,
  getExplorerUrl,
  type FunctionExport,
  type AutonomifyExport,
} from "autonomify-sdk"
import { triggerCRE } from "../src/lib/agent/cre"

// Output mode
let VERBOSE = false
let QUIET = false

// Console helpers
const log = (...args: unknown[]) => {
  if (!QUIET) console.log(...args)
}

const debug = (...args: unknown[]) => {
  if (VERBOSE) console.log(...args)
}

const header = (text: string) => {
  log(`\n${"─".repeat(60)}`)
  log(`  ${text}`)
  log("─".repeat(60))
}

const SCENARIOS = [
  // === DEMO CASE STUDY 0: Introduction ===
  {
    name: "Intro - capabilities",
    messages: ["Hey, what can you do?"],
    category: "intro",
  },
  {
    name: "Intro - available tokens",
    messages: ["What tokens do I have available?"],
    category: "intro",
  },
  {
    name: "Intro - how it works",
    messages: ["How do you execute transactions securely?"],
    category: "intro",
  },
  // === DEMO CASE STUDY 1: Simple LINK Transfer ===
  {
    name: "Check own balance",
    messages: ["What's my LINK balance?"],
    category: "balance",
  },
  {
    name: "Check balances (multi)",
    messages: ["Check my WETH and LINK balances"],
    category: "balance",
  },
  {
    name: "Simulate transfer",
    messages: [
      "Simulate sending 0.01 LINK to 0xdead000000000000000000000000000000000001",
    ],
    category: "simulate",
  },
  {
    name: "E2E transfer",
    messages: [
      "Transfer 0.01 LINK to 0xf2750684eb187fF9f82e2F980f6233707ef5768c",
      "Yes, proceed with the transfer",
    ],
    category: "e2e",
  },
  // === DEMO CASE STUDY 2: DEX Operations ===
  {
    name: "Get quote",
    messages: ["Get me a quote to swap 0.1 LINK for WETH"],
    category: "quote",
  },
  {
    name: "Simulate swap",
    messages: [
      "Get me a quote to swap 0.05 LINK for WETH",
      "Now simulate that swap to make sure it would work",
    ],
    category: "simulate",
  },
  {
    name: "Full simulate then execute",
    messages: [
      "I want to transfer 0.001 LINK to 0xf2750684eb187fF9f82e2F980f6233707ef5768c. First simulate it.",
      "Great, now execute the actual transfer",
    ],
    category: "e2e",
  },
]

interface ConversationMessage {
  role: "user" | "assistant" | "system" | "tool"
  content: string
}

async function loadAgentContext(agentId: string) {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1)

  if (!agent) throw new Error(`Agent ${agentId} not found`)

  const contracts = await db
    .select()
    .from(agentContracts)
    .where(eq(agentContracts.agentId, agentId))

  const [delegation] = await db
    .select()
    .from(delegations)
    .where(eq(delegations.userAddress, agent.ownerAddress))
    .limit(1)

  return { agent, contracts, delegation }
}

function buildExportData(
  agent: typeof agents.$inferSelect,
  contracts: (typeof agentContracts.$inferSelect)[]
): AutonomifyExport {
  const primaryContract = contracts[0]
  const chainId = primaryContract?.chainId || 84532
  const chain = getChainOrThrow(chainId)

  const contractsMap: AutonomifyExport["contracts"] = {}

  for (const contract of contracts) {
    const functions = contract.functions as FunctionExport[]
    const metadata = contract.metadata as Record<string, unknown>
    const analysis = contract.analysis as Record<string, unknown> | null
    const functionDescriptions = (analysis?.functionDescriptions || {}) as Record<string, string>

    const contractName =
      (metadata.name as string) ||
      (analysis?.name as string) ||
      (analysis?.contractType as string) ||
      contract.address.slice(0, 10)

    contractsMap[contract.address.toLowerCase() as `0x${string}`] = {
      name: contractName,
      abi: contract.abi as Abi,
      metadata: {
        ...metadata,
        ...(analysis && {
          summary: analysis.summary,
          contractType: analysis.contractType,
          capabilities: analysis.capabilities,
        }),
      },
      functions: functions.map((fn) => ({
        ...fn,
        description: functionDescriptions[fn.name],
      })),
    }
  }

  return {
    version: "1.0.0",
    executor: {
      address: "0xd44Def7f75FeA04B402688ff14572129D2BeEb05" as `0x${string}`,
      abi: [],
    },
    chain: {
      id: chainId,
      name: chain.name,
      rpc: chain.rpc[0],
    },
    contracts: contractsMap,
  }
}

function buildSystemPrompt(
  agent: typeof agents.$inferSelect,
  exportData: AutonomifyExport
): string {
  const sdkPrompt = buildPrompt(exportData)

  return `## YOUR IDENTITY
- Agent: ${agent.name}
- Owner Wallet: ${agent.ownerAddress}
- Channel: telegram

## KEY BEHAVIOR
- When user asks about "my balance" or "the balance", they mean THEIR token balance
- Use the owner wallet address (${agent.ownerAddress}) when checking balances for the user
- For view/read functions (balanceOf, allowance, etc.), call them directly
- For write functions (transfer, approve, etc.), confirm with user first

${sdkPrompt}`
}

async function runConversation(
  scenario: (typeof SCENARIOS)[0],
  agent: typeof agents.$inferSelect,
  exportData: AutonomifyExport,
  delegation: typeof delegations.$inferSelect | null,
  rpcUrl: string,
  chainId: number
): Promise<{ passed: boolean; error?: string }> {
  header(`SCENARIO: ${scenario.name}`)

  const systemPrompt = buildSystemPrompt(agent, exportData)
  const conversationHistory: ConversationMessage[] = []

  // Create execute tool
  const autonomify_execute = tool({
    description:
      "Execute a smart contract function. For view/pure functions, returns the result directly. For write functions, executes the transaction.",
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).default({}).describe("Named arguments as object"),
      value: z.string().optional().describe("Native token value in ETH"),
    }),
    execute: async ({ contractAddress, functionName, args = {} }) => {
      const contractKey = contractAddress.toLowerCase() as `0x${string}`
      const contractData = exportData.contracts[contractKey]

      if (!contractData) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const fn = contractData.functions.find((f) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      const isQuoterFunction = functionName.startsWith("quote")
      if (isReadOnly(fn) || isQuoterFunction) {
        const client = createPublicClient({ transport: http(rpcUrl) })
        const argsArray = Object.values(args)

        try {
          const result = await client.readContract({
            address: contractKey,
            abi: contractData.abi,
            functionName,
            args: argsArray,
          })

          if (functionName === "balanceOf" && typeof result === "bigint") {
            const decimals = (contractData.metadata.decimals as number) || 18
            const symbol = (contractData.metadata.symbol as string) || "tokens"
            const formatted = formatUnits(result, decimals)
            return { success: true, result: `${formatted} ${symbol}`, raw: result.toString() }
          }

          if (functionName.startsWith("quote") && Array.isArray(result)) {
            const [amountOut, sqrtPriceX96After, ticksCrossed, gasEstimate] = result
            return {
              success: true,
              result: {
                amountOut: formatUnits(amountOut as bigint, 18),
                amountOutRaw: String(amountOut),
                sqrtPriceX96After: String(sqrtPriceX96After),
                ticksCrossed: Number(ticksCrossed),
                gasEstimate: String(gasEstimate),
              },
            }
          }

          const serializeResult = (val: unknown): unknown => {
            if (typeof val === "bigint") return val.toString()
            if (Array.isArray(val)) return val.map(serializeResult)
            if (val && typeof val === "object") {
              const obj: Record<string, unknown> = {}
              for (const [k, v] of Object.entries(val)) {
                obj[k] = serializeResult(v)
              }
              return obj
            }
            return val
          }

          return { success: true, result: serializeResult(result) }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : "Read failed" }
        }
      }

      // Write function
      const normalizedArgs = Object.entries(args).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)
      const argsArray = Object.values(normalizedArgs)
      const calldata = encodeFunctionData({
        abi: contractData.abi,
        functionName,
        args: argsArray,
      })

      debug(`  [CRE] ${functionName} on ${contractAddress.slice(0, 10)}...`)

      try {
        const result = await triggerCRE({
          userAddress: agent.ownerAddress,
          agentId: agent.agentIdBytes!,
          target: contractKey,
          calldata,
          value: "0",
          permissionsContext: delegation?.signedDelegation || "0x",
          simulateOnly: false,
        })

        debug(`  [CRE] Result: ${JSON.stringify(result)}`)

        if (result.success && result.mode === "execution") {
          const explorerUrl = result.txHash ? getExplorerUrl(chainId, result.txHash) : null
          return {
            success: true,
            txHash: result.txHash,
            explorerUrl,
            message: `Transaction executed`,
          }
        } else {
          return { success: false, error: (result as any).error || "CRE execution failed" }
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "CRE trigger failed" }
      }
    },
  })

  // Create simulate tool
  const autonomify_simulate = tool({
    description:
      "Simulate a transaction WITHOUT executing it. Use this to verify a transaction will succeed before committing.",
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).default({}).describe("Named arguments as object"),
      value: z.string().optional().describe("Native token value in ETH"),
    }),
    execute: async ({ contractAddress, functionName, args = {} }) => {
      const contractKey = contractAddress.toLowerCase() as `0x${string}`
      const contractData = exportData.contracts[contractKey]

      if (!contractData) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const fn = contractData.functions.find((f) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      const normalizedArgs = Object.entries(args).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)
      const argsArray = Object.values(normalizedArgs)
      const calldata = encodeFunctionData({
        abi: contractData.abi,
        functionName,
        args: argsArray,
      })

      debug(`  [SIM] ${functionName} on ${contractAddress.slice(0, 10)}...`)

      try {
        const result = await triggerCRE({
          userAddress: agent.ownerAddress,
          agentId: agent.agentIdBytes!,
          target: contractKey,
          calldata,
          value: "0",
          permissionsContext: delegation?.signedDelegation || "0x",
          simulateOnly: true,
        })

        debug(`  [SIM] Result: ${JSON.stringify(result)}`)

        if (result.success) {
          return {
            success: true,
            wouldSucceed: true,
            gasEstimate: (result as any).gasEstimate,
            message: "Simulation passed. Transaction would succeed.",
          }
        } else {
          return {
            success: true,
            wouldSucceed: false,
            error: (result as any).error,
            message: "Simulation failed. Transaction would revert.",
          }
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Simulation failed" }
      }
    },
  })

  try {
    for (const userMessage of scenario.messages) {
      log(`\n  User: ${userMessage}`)
      conversationHistory.push({ role: "user", content: userMessage })

      const response = await generateText({
        model: openai("gpt-4o"),
        system: systemPrompt,
        messages: conversationHistory.map((m) => ({
          role: m.role as any,
          content: m.content,
        })),
        tools: { autonomify_execute, autonomify_simulate },
        maxSteps: 5,
      })

      // Show tool calls in verbose mode
      if (VERBOSE) {
        for (const step of response.steps) {
          if (step.toolCalls.length > 0) {
            for (const tc of step.toolCalls) {
              log(`\n  [Tool: ${tc.toolName}]`)
              log(`  Args: ${JSON.stringify(tc.args, null, 2)}`)
            }
          }
          if (step.toolResults.length > 0) {
            for (const tr of step.toolResults) {
              log(`  Result: ${JSON.stringify(tr.result, null, 2)}`)
            }
          }
        }
      } else {
        // In normal mode, show summary of tool usage
        for (const step of response.steps) {
          for (const tc of step.toolCalls) {
            const fnName = (tc.args as any).functionName || "?"
            const contract = ((tc.args as any).contractAddress || "").slice(0, 10)
            if (tc.toolName === "autonomify_simulate") {
              log(`  → Simulating ${fnName} on ${contract}...`)
            } else if (tc.toolName === "autonomify_execute") {
              log(`  → Calling ${fnName} on ${contract}...`)
            }
          }
          for (const tr of step.toolResults) {
            const result = tr.result as any
            if (result.txHash) {
              log(`  ✓ TX: ${result.txHash}`)
            } else if (result.wouldSucceed !== undefined) {
              log(`  ✓ Simulation: ${result.wouldSucceed ? "would succeed" : "would fail"}`)
            } else if (result.result) {
              const display = typeof result.result === "string"
                ? result.result
                : JSON.stringify(result.result).slice(0, 60)
              log(`  ✓ Result: ${display}`)
            }
          }
        }
      }

      // Show agent response (truncate if too long)
      const responseText = response.text.length > 300
        ? response.text.slice(0, 300) + "..."
        : response.text
      log(`\n  Agent: ${responseText}`)
      conversationHistory.push({ role: "assistant", content: response.text })
    }

    return { passed: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error"
    log(`  ✗ Error: ${errorMsg}`)
    return { passed: false, error: errorMsg }
  }
}

function printUsage() {
  console.log(`
Usage: pnpm tsx scripts/test-agent-conversation.ts [options] [scenario]

Options:
  --agent=<id>      Agent ID (UUID) - defaults to first agent
  --verbose         Show detailed output including tool internals
  --quiet           Minimal output, just pass/fail
  --list            List available scenarios and exit

Scenarios (partial match):
  "Intro"           Introduction scenarios
  "balance"         Balance check scenarios
  "transfer"        Transfer scenarios
  "E2E"             End-to-end with confirmation
  "quote"           DEX quote scenarios
  "simulate"        Simulation scenarios

Examples:
  pnpm tsx scripts/test-agent-conversation.ts --list
  pnpm tsx scripts/test-agent-conversation.ts "balance"
  pnpm tsx scripts/test-agent-conversation.ts --verbose "E2E"
  pnpm tsx scripts/test-agent-conversation.ts --agent=abc123 "quote"
`)
}

async function main() {
  const args = process.argv.slice(2)

  // Parse flags
  let agentId: string | undefined
  let scenarioFilter: string | undefined
  let showList = false

  for (const arg of args) {
    if (arg === "--verbose") {
      VERBOSE = true
    } else if (arg === "--quiet") {
      QUIET = true
    } else if (arg === "--list") {
      showList = true
    } else if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    } else if (arg.startsWith("--agent=")) {
      agentId = arg.slice(8)
    } else if (!arg.startsWith("--")) {
      // First non-flag arg is scenario filter (or agent ID if UUID)
      if (arg.match(/^[0-9a-f-]{36}$/i)) {
        agentId = arg
      } else {
        scenarioFilter = arg
      }
    }
  }

  // Show scenario list
  if (showList) {
    console.log("\nAvailable scenarios:\n")
    const categories = [...new Set(SCENARIOS.map((s) => s.category))]
    for (const cat of categories) {
      console.log(`  ${cat.toUpperCase()}:`)
      SCENARIOS.filter((s) => s.category === cat).forEach((s) => {
        console.log(`    - "${s.name}"`)
      })
    }
    console.log()
    process.exit(0)
  }

  // Find agent
  let agent: typeof agents.$inferSelect | undefined
  if (agentId) {
    const result = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
    agent = result[0]
  } else {
    const result = await db.select().from(agents).limit(1)
    agent = result[0]
  }

  if (!agent) {
    console.error("No agents found. Create one first or specify a valid agent ID.")
    printUsage()
    process.exit(1)
  }

  log(`\n${"═".repeat(60)}`)
  log(`  AUTONOMIFY TEST HARNESS`)
  log("═".repeat(60))
  log(`  Agent: ${agent.name}`)
  log(`  Owner: ${agent.ownerAddress.slice(0, 10)}...${agent.ownerAddress.slice(-8)}`)

  const { contracts, delegation } = await loadAgentContext(agent.id)

  if (contracts.length === 0) {
    console.error("No contracts attached to agent.")
    process.exit(1)
  }

  log(`  Contracts: ${contracts.length}`)
  log(`  Delegation: ${delegation ? "✓" : "✗"}`)

  if (VERBOSE) {
    for (const c of contracts) {
      const meta = c.metadata as Record<string, unknown>
      const analysis = c.analysis as Record<string, unknown> | null
      const name = (meta.name as string) || (analysis?.name as string) || c.address.slice(0, 10)
      log(`    - ${name} (${c.address.slice(0, 10)}...)`)
    }
  }

  const exportData = buildExportData(agent, contracts)
  const chainId = contracts[0].chainId
  const rpcUrl = getBestRpcUrl(chainId)

  // Filter scenarios
  const scenariosToRun = scenarioFilter
    ? SCENARIOS.filter((s) =>
        s.name.toLowerCase().includes(scenarioFilter.toLowerCase()) ||
        s.category.toLowerCase().includes(scenarioFilter.toLowerCase())
      )
    : SCENARIOS.slice(0, 2)

  if (scenariosToRun.length === 0) {
    console.error(`No scenarios match "${scenarioFilter}"`)
    console.error("Use --list to see available scenarios")
    process.exit(1)
  }

  log(`  Running: ${scenariosToRun.length} scenario(s)`)

  // Run scenarios
  const results: { name: string; passed: boolean; error?: string }[] = []

  for (const scenario of scenariosToRun) {
    const result = await runConversation(
      scenario,
      agent,
      exportData,
      delegation,
      rpcUrl,
      chainId
    )
    results.push({ name: scenario.name, ...result })
  }

  // Summary
  log(`\n${"═".repeat(60)}`)
  log(`  RESULTS`)
  log("═".repeat(60))

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length

  for (const r of results) {
    log(`  ${r.passed ? "✓" : "✗"} ${r.name}${r.error ? ` - ${r.error}` : ""}`)
  }

  log(`\n  Total: ${passed} passed, ${failed} failed`)
  log("═".repeat(60) + "\n")

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
