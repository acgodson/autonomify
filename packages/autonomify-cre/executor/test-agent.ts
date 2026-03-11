#!/usr/bin/env bun
/**
 * Autonomify AI Agent Test
 *
 * Self-contained test script that runs AI agent conversations with CRE simulation.
 * This demonstrates the full flow: AI understands request -> encodes tx -> CRE simulates/executes
 *
 * Prerequisites:
 *   1. Ensure ../.env has:
 *      - CRE_ETH_PRIVATE_KEY (for broadcasting)
 *      - OPENAI_API_KEY (for AI agent)
 *   2. Ensure CRE server is running: bun run serve
 *
 * Usage:
 *   bun run test              # Run all scenarios
 *   bun run test:balance      # Run balance check only
 *   bun run test:simulate     # Run simulation only
 *   bun run test:quote        # Run DEX quote only
 */

// Load .env from parent directory (packages/autonomify-cre/.env)
import { config } from "dotenv"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, "../.env") })

import { generateText, tool } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"
import {
  createPublicClient,
  http,
  encodeFunctionData,
  formatUnits,
  getAddress,
  type Abi,
} from "viem"

// ==================== CONFIGURATION ====================

const CRE_URL = process.env.CRE_TRIGGER_URL || "http://localhost:8080/trigger"
const BASE_SEPOLIA_RPC = "https://sepolia.base.org"
const CHAIN_ID = 84532

// Demo owner address (from CRE Test Bot)
const OWNER_ADDRESS = "0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720"
const AGENT_ID = "0xf282e595f2043e9da73b7907b8b3af06a69e5620aee69ce7e9796e2fd65e5beb"

// Signed delegation for CRE Test Bot (pre-signed, allows simulation/execution)
const SIGNED_DELEGATION = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000063c0c19a282a1b52b07dd5a65b58948a07dae32b00000000000000000000000016e0e7141261bbf34b4707ced40ef0bb2f2a372000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000067cba22e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000d44def7f75fea04b402688ff14572129d2beeb05000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000446c32dee9000000000000000000000000f2750684eb187ff9f82e2f980f6233707ef5768c0000000000000000000000000000000000000000000000000000000000014c080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000600000000000000000000000009765c5c03b5cd04d90df5c2a3aa63b1ec0d6cdff000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041a77f01a0db396af68ba69a1e6b61b6b0b4b5e0f91a64caab29bf75424b2f4c9a60f6e67f3f4e17ac3ccac1b3a0b8a60f7e22a1e53c3d2ef3e0f5f6afde29e1dd91c00000000000000000000000000000000000000000000000000000000000000"

// ==================== CONTRACT ABIs ====================

// Minimal ERC20 ABI for balanceOf and transfer
const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const

// Uniswap V3 QuoterV2 ABI (for getting swap quotes)
const QUOTER_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const

// Contract addresses on Base Sepolia
const CONTRACTS = {
  LINK: {
    address: "0xe4ab69c077896252fafbd49efd26b5d171a32410" as `0x${string}`,
    name: "ChainLink Token",
    symbol: "LINK",
    decimals: 18,
    abi: ERC20_ABI,
  },
  WETH: {
    address: "0x4200000000000000000000000000000000000006" as `0x${string}`,
    name: "Wrapped Ether",
    symbol: "WETH",
    decimals: 18,
    abi: ERC20_ABI,
  },
  QUOTER: {
    address: "0xc5290058841028f1614f3a6f0f5816cad0df5e27" as `0x${string}`,
    name: "Uniswap V3 Quoter",
    abi: QUOTER_ABI,
  },
}

// ==================== CRE TRIGGER ====================

interface CREResult {
  success: boolean
  mode: "simulation" | "execution"
  gasEstimate?: number
  txHash?: string
  txStatusName?: string
  error?: {
    type: string
    message?: string
  }
}

async function triggerCRE(params: {
  target: string
  calldata: string
  simulateOnly: boolean
}): Promise<CREResult> {
  const payload = {
    userAddress: OWNER_ADDRESS,
    agentId: AGENT_ID,
    execution: {
      target: params.target,
      value: "0",
      calldata: params.calldata,
    },
    permissionsContext: SIGNED_DELEGATION,
    simulateOnly: params.simulateOnly,
  }

  const response = await fetch(CRE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    return {
      success: false,
      mode: params.simulateOnly ? "simulation" : "execution",
      error: { type: "http_error", message: `${response.status}: ${text}` },
    }
  }

  return response.json()
}

// ==================== SYSTEM PROMPT ====================

const SYSTEM_PROMPT = `You are an autonomous onchain agent on Base Sepolia testnet.

## Your Identity
- Agent Name: Demo Agent
- Owner Wallet: ${OWNER_ADDRESS}

## Available Contracts

### ChainLink Token (LINK)
Address: \`${CONTRACTS.LINK.address}\`
Symbol: LINK
Decimals: 18
Functions:
- balanceOf(address account) [view] - Check token balance
- transfer(address to, uint256 amount) - Transfer tokens

### Wrapped Ether (WETH)
Address: \`${CONTRACTS.WETH.address}\`
Symbol: WETH
Decimals: 18
Functions:
- balanceOf(address account) [view] - Check token balance
- transfer(address to, uint256 amount) - Transfer tokens

### Uniswap V3 Quoter
Address: \`${CONTRACTS.QUOTER.address}\`
Functions:
- quoteExactInputSingle(tuple params) - Get swap quote
  - params: { tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96 }

## Key Behavior
- When user asks about "my balance", use the owner wallet address
- For view/read functions, call them directly via autonomify_execute
- For write functions, use autonomify_simulate first to verify, then confirm with user
- Convert amounts: 1 LINK = 1000000000000000000 (18 decimals)
- For quotes, use fee=3000 (0.3% pool) and sqrtPriceLimitX96=0

## Tool Usage
Use autonomify_execute for all contract calls. The tool handles both read and write operations.
Use autonomify_simulate to test write operations before executing.

Be concise. Show balances in human format (e.g., "0.5 LINK" not "500000000000000000").
`

// ==================== AI TOOLS ====================

function createTools() {
  const client = createPublicClient({ transport: http(BASE_SEPOLIA_RPC) })

  const autonomify_execute = tool({
    description: "Execute a smart contract function. For view functions, returns result. For write functions, executes via CRE.",
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).default({}).describe("Named arguments as object"),
    }),
    execute: async ({ contractAddress, functionName, args = {} }) => {
      const addr = contractAddress.toLowerCase() as `0x${string}`

      // Find contract
      const contract = Object.values(CONTRACTS).find(
        (c) => c.address.toLowerCase() === addr
      )
      if (!contract) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      // Check if view function
      const fn = contract.abi.find((f: any) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      const isView = (fn as any).stateMutability === "view"
      const argsArray = Object.values(args)

      if (isView) {
        // Direct RPC call for view functions
        try {
          const result = await client.readContract({
            address: addr,
            abi: contract.abi as Abi,
            functionName,
            args: argsArray,
          })

          // Format balance results
          if (functionName === "balanceOf" && typeof result === "bigint") {
            const decimals = "decimals" in contract ? contract.decimals : 18
            const symbol = "symbol" in contract ? contract.symbol : "tokens"
            return {
              success: true,
              result: `${formatUnits(result, decimals)} ${symbol}`,
              raw: result.toString(),
            }
          }

          // Handle quote results (tuple return)
          if (functionName === "quoteExactInputSingle" && Array.isArray(result)) {
            const [amountOut, , , gasEstimate] = result
            return {
              success: true,
              result: {
                amountOut: formatUnits(amountOut as bigint, 18),
                gasEstimate: String(gasEstimate),
              },
            }
          }

          return { success: true, result: String(result) }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : "Read failed" }
        }
      }

      // For non-view functions, check if it's a quoter function (designed for eth_call)
      if (functionName.startsWith("quote")) {
        try {
          const result = await client.readContract({
            address: addr,
            abi: contract.abi as Abi,
            functionName,
            args: argsArray,
          })

          if (Array.isArray(result)) {
            const [amountOut, , , gasEstimate] = result
            return {
              success: true,
              result: {
                amountOut: formatUnits(amountOut as bigint, 18),
                amountOutRaw: String(amountOut),
                gasEstimate: String(gasEstimate),
              },
            }
          }
          return { success: true, result }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : "Quote failed" }
        }
      }

      // Write function - encode and execute via CRE
      const normalizedArgs = Object.entries(args).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)

      const calldata = encodeFunctionData({
        abi: contract.abi as Abi,
        functionName,
        args: Object.values(normalizedArgs),
      })

      const result = await triggerCRE({
        target: addr,
        calldata,
        simulateOnly: false,
      })

      if (result.success && result.txHash) {
        return {
          success: true,
          txHash: result.txHash,
          explorerUrl: `https://sepolia.basescan.org/tx/${result.txHash}`,
        }
      }

      return { success: false, error: result.error || "Execution failed" }
    },
  })

  const autonomify_simulate = tool({
    description: "Simulate a transaction WITHOUT executing. Use to verify a transaction would succeed.",
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).default({}).describe("Named arguments as object"),
    }),
    execute: async ({ contractAddress, functionName, args = {} }) => {
      const addr = contractAddress.toLowerCase() as `0x${string}`

      const contract = Object.values(CONTRACTS).find(
        (c) => c.address.toLowerCase() === addr
      )
      if (!contract) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const normalizedArgs = Object.entries(args).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)

      const calldata = encodeFunctionData({
        abi: contract.abi as Abi,
        functionName,
        args: Object.values(normalizedArgs),
      })

      const result = await triggerCRE({
        target: addr,
        calldata,
        simulateOnly: true,
      })

      if (result.success) {
        return {
          success: true,
          wouldSucceed: true,
          gasEstimate: result.gasEstimate,
          message: "Simulation passed. Transaction would succeed.",
        }
      }

      return {
        success: true,
        wouldSucceed: false,
        error: result.error,
        message: "Simulation failed. Transaction would revert.",
      }
    },
  })

  return { autonomify_execute, autonomify_simulate }
}

// ==================== TEST SCENARIOS ====================

interface Scenario {
  name: string
  category: string
  messages: string[]
}

const SCENARIOS: Scenario[] = [
  // Balance checks (no CRE, direct RPC)
  {
    name: "Check LINK balance",
    category: "balance",
    messages: ["What's my LINK balance?"],
  },
  {
    name: "Check multiple balances",
    category: "balance",
    messages: ["Check my WETH and LINK balances"],
  },

  // DEX Quote (no CRE, direct RPC with tuple encoding)
  {
    name: "Get swap quote",
    category: "quote",
    messages: ["Get me a quote to swap 0.1 LINK for WETH"],
  },

  // CRE Simulation - requires CRE server running (bun run serve)
  {
    name: "Simulate transfer",
    category: "simulate",
    messages: ["Simulate sending 0.001 LINK to 0xf2750684eb187fF9f82e2F980f6233707ef5768c"],
  },

  // CRE Execution - requires CRE server running (bun run serve)
  {
    name: "Execute transfer",
    category: "execute",
    messages: [
      "Transfer 0.001 LINK to 0xf2750684eb187fF9f82e2F980f6233707ef5768c",
      "Yes, confirm the transfer",
    ],
  },
]

// ==================== TEST RUNNER ====================

async function runScenario(scenario: Scenario): Promise<{ passed: boolean; error?: string }> {
  console.log(`\n${"─".repeat(60)}`)
  console.log(`  SCENARIO: ${scenario.name}`)
  console.log("─".repeat(60))

  const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const tools = createTools()
  const conversationHistory: { role: "user" | "assistant"; content: string }[] = []

  try {
    for (const userMessage of scenario.messages) {
      console.log(`\n  User: ${userMessage}`)
      conversationHistory.push({ role: "user", content: userMessage })

      const response = await generateText({
        model: openai("gpt-4o"),
        system: SYSTEM_PROMPT,
        messages: conversationHistory,
        tools,
        maxSteps: 5,
      })

      // Show tool usage summary
      for (const step of response.steps) {
        for (const tc of step.toolCalls) {
          const fnName = (tc.args as any).functionName || "?"
          const contract = ((tc.args as any).contractAddress || "").slice(0, 10)
          if (tc.toolName === "autonomify_simulate") {
            console.log(`  -> Simulating ${fnName} on ${contract}...`)
          } else {
            console.log(`  -> Calling ${fnName} on ${contract}...`)
          }
        }
        for (const tr of step.toolResults) {
          const result = tr.result as any
          if (result.txHash) {
            console.log(`  [TX] ${result.txHash}`)
          } else if (result.wouldSucceed !== undefined) {
            console.log(`  [SIM] ${result.wouldSucceed ? "would succeed" : "would fail"}`)
          } else if (result.result) {
            const display = typeof result.result === "string"
              ? result.result
              : JSON.stringify(result.result).slice(0, 60)
            console.log(`  [OK] ${display}`)
          }
        }
      }

      const responseText = response.text.length > 300
        ? response.text.slice(0, 300) + "..."
        : response.text
      console.log(`\n  Agent: ${responseText}`)
      conversationHistory.push({ role: "assistant", content: response.text })
    }

    return { passed: true }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error"
    console.log(`  [ERROR] ${errorMsg}`)
    return { passed: false, error: errorMsg }
  }
}

async function main() {
  // Check environment
  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY not set in .env")
    console.error("Copy .env.example to .env and fill in your OpenAI API key")
    process.exit(1)
  }

  const filter = process.argv[2]?.toLowerCase()

  console.log("═".repeat(60))
  console.log("  AUTONOMIFY AI AGENT TEST")
  console.log("═".repeat(60))
  console.log(`  Owner: ${OWNER_ADDRESS.slice(0, 10)}...${OWNER_ADDRESS.slice(-8)}`)
  console.log(`  CRE URL: ${CRE_URL}`)
  console.log(`  Chain: Base Sepolia (${CHAIN_ID})`)

  // Filter scenarios
  const scenariosToRun = filter
    ? SCENARIOS.filter(s =>
        s.name.toLowerCase().includes(filter) ||
        s.category.toLowerCase().includes(filter)
      )
    : SCENARIOS

  if (scenariosToRun.length === 0) {
    console.error(`\nNo scenarios match "${filter}"`)
    console.error("Available categories: balance, quote, simulate")
    process.exit(1)
  }

  console.log(`  Running: ${scenariosToRun.length} scenario(s)`)

  // Run scenarios
  const results: { name: string; passed: boolean; error?: string }[] = []

  for (const scenario of scenariosToRun) {
    const result = await runScenario(scenario)
    results.push({ name: scenario.name, ...result })
  }

  // Summary
  console.log(`\n${"═".repeat(60)}`)
  console.log("  RESULTS")
  console.log("═".repeat(60))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  for (const r of results) {
    console.log(`  ${r.passed ? "+" : "x"} ${r.name}${r.error ? ` - ${r.error}` : ""}`)
  }

  console.log(`\n  Total: ${passed} passed, ${failed} failed`)
  console.log("═".repeat(60) + "\n")

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
