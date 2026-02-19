/**
 * Autonomify Tool for Vercel AI SDK
 *
 * Creates a universal tool that any LLM can use to execute contract functions.
 * Wallet/signing is handled by the user-provided signAndSend function.
 *
 * @example
 * ```typescript
 * import { createAutonomifyTool } from 'autonomify-sdk'
 * import exportJson from './autonomify.json'
 *
 * const autonomify = createAutonomifyTool({
 *   export: exportJson,
 *   agentId: '0x...',
 *   signAndSend: async (tx) => {
 *     // Your wallet logic here
 *     return await wallet.sendTransaction(tx)
 *   }
 * })
 *
 * // Use with any LLM
 * const result = await generateText({
 *   model: openai('gpt-4'),
 *   tools: { autonomify_execute: autonomify },
 *   system: buildSystemPrompt(exportJson),
 *   prompt: 'Send 100 USDT to 0xABC'
 * })
 * ```
 */

import { tool } from "ai"
import { z } from "zod"
import { createPublicClient, http } from "viem"
import { buildTransaction, buildSimulationTransaction } from "./encoder"
import type {
  AutonomifyToolConfig,
  ExecuteParams,
  ExecuteResult,
  AutonomifyExport,
} from "./types"

/**
 * Create the universal Autonomify tool for Vercel AI SDK
 */
export function createAutonomifyTool(config: AutonomifyToolConfig) {
  const { export: exportData, agentId, signAndSend } = config

  // Build description with available contracts
  const contractList = Object.entries(exportData.contracts)
    .map(([addr, c]) => `${c.name} (${addr})`)
    .join(", ")

  return tool({
    description: `Execute a smart contract function via Autonomify. Available contracts: ${contractList}`,
    parameters: z.object({
      contractAddress: z
        .string()
        .describe("The contract address to call"),
      functionName: z
        .string()
        .describe("The function name to call"),
      args: z
        .array(z.any())
        .describe("Function arguments in order"),
      value: z
        .string()
        .optional()
        .describe("BNB to send (for payable functions), in ether units like '0.1'"),
    }),
    execute: async (params): Promise<ExecuteResult> => {
      try {
        const executeParams: ExecuteParams = {
          contractAddress: params.contractAddress as `0x${string}`,
          functionName: params.functionName,
          args: params.args,
          value: params.value,
        }

        // Build the transaction
        const tx = buildTransaction(exportData, agentId, executeParams)

        // Sign and send via user's wallet
        const txHash = await signAndSend(tx)

        return {
          success: true,
          txHash,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Execution failed",
        }
      }
    },
  })
}

/**
 * Create a simulation-only tool (no signing required)
 * Useful for testing if LLM outputs valid calls
 */
export function createAutonomifySimulator(exportData: AutonomifyExport) {
  const publicClient = createPublicClient({
    transport: http(exportData.chain.rpc),
  })

  const contractList = Object.entries(exportData.contracts)
    .map(([addr, c]) => `${c.name} (${addr})`)
    .join(", ")

  return tool({
    description: `Simulate a smart contract function call (dry run). Available contracts: ${contractList}`,
    parameters: z.object({
      contractAddress: z
        .string()
        .describe("The contract address to call"),
      functionName: z
        .string()
        .describe("The function name to call"),
      args: z
        .array(z.any())
        .describe("Function arguments in order"),
      value: z
        .string()
        .optional()
        .describe("BNB to send (for payable functions)"),
    }),
    execute: async (params): Promise<ExecuteResult> => {
      try {
        const executeParams: ExecuteParams = {
          contractAddress: params.contractAddress as `0x${string}`,
          functionName: params.functionName,
          args: params.args,
          value: params.value,
        }

        const tx = buildSimulationTransaction(exportData, executeParams)

        // Simulate via eth_call
        const result = await publicClient.call({
          to: tx.to,
          data: tx.data,
          value: tx.value,
        })

        return {
          success: true,
          simulationResult: result.data,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Simulation failed",
        }
      }
    },
  })
}

/**
 * Build a system prompt that describes available contracts to the LLM
 */
export function buildSystemPrompt(exportData: AutonomifyExport): string {
  const contractDescriptions = Object.entries(exportData.contracts)
    .map(([address, contract]) => {
      const functions = contract.functions
        .map((fn) => {
          const inputs = fn.inputs
            .map((i) => `${i.type} ${i.name}`)
            .join(", ")
          return `  - ${fn.name}(${inputs}) [${fn.stateMutability}]`
        })
        .join("\n")

      const metadata = Object.entries(contract.metadata)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join("\n")

      return `
Contract: ${contract.name}
Address: ${address}
${metadata ? `Metadata:\n${metadata}` : ""}
Functions:
${functions}
`
    })
    .join("\n---\n")

  return `You are an onchain execution agent powered by Autonomify.

Chain: ${exportData.chain.name} (ID: ${exportData.chain.id})

Available Contracts:
${contractDescriptions}

When the user requests an action:
1. Identify the correct contract and function
2. Format arguments correctly (addresses as 0x strings, amounts as strings in wei)
3. Use the autonomify_execute tool to execute

For token amounts, convert to wei using the token's decimals.
For example: 100 USDT (18 decimals) = "100000000000000000000"

Always confirm what you're about to do before executing.`
}
