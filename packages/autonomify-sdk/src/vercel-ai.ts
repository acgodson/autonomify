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
import { createPublicClient, http, decodeFunctionResult, type AbiFunction } from "viem"
import { buildTransaction, encodeContractCall } from "./encoder"
import type {
  AutonomifyToolConfig,
  ExecuteParams,
  ExecuteResult,
  AutonomifyExport,
} from "./types"

/**
 * Convert BigInts to strings recursively for JSON serialization
 */
function serializeBigInts(obj: unknown): unknown {
  if (typeof obj === "bigint") {
    return obj.toString()
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts)
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value)
    }
    return result
  }
  return obj
}

/**
 * Find function ABI by name
 */
function findFunction(
  exportData: AutonomifyExport,
  contractAddress: `0x${string}`,
  functionName: string
): AbiFunction | undefined {
  const contract = exportData.contracts[contractAddress]
  if (!contract) return undefined

  return contract.abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && item.name === functionName
  )
}

/**
 * Check if function is read-only (view/pure)
 */
function isReadOnly(fn: AbiFunction): boolean {
  return fn.stateMutability === "view" || fn.stateMutability === "pure"
}

/**
 * Create the universal Autonomify tool for Vercel AI SDK
 *
 * Automatically routes:
 * - view/pure functions → free eth_call (no gas)
 * - nonpayable/payable functions → executor contract (requires gas)
 */
export function createAutonomifyTool(config: AutonomifyToolConfig) {
  const { export: exportData, agentId, signAndSend } = config

  // Create public client for free read calls
  const publicClient = createPublicClient({
    transport: http(exportData.chain.rpc),
  })

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
        .array(z.union([
          z.string(),
          z.number(),
          z.boolean(),
          z.array(z.string())  // Support array arguments like address[] for getAmountsOut path
        ]))
        .describe("Function arguments in order. For functions with array parameters (like getAmountsOut's address[] path), pass the array as a NESTED array element. Example for getAmountsOut(uint256 amountIn, address[] path): args=[\"1000000\", [\"0xWBNB...\", \"0xUSDT...\"]] - note the path is a nested array, NOT separate elements."),
      value: z
        .string()
        .optional()
        .describe("BNB to send (for payable functions), in ether units like '0.1'"),
    }),
    execute: async (params): Promise<ExecuteResult> => {
      try {
        // Normalize address to checksum format for lookup
        const inputAddress = params.contractAddress.toLowerCase()
        const contractEntry = Object.entries(exportData.contracts).find(
          ([addr]) => addr.toLowerCase() === inputAddress
        )

        if (!contractEntry) {
          return {
            success: false,
            error: `Contract ${params.contractAddress} not found in export`,
          }
        }

        const [contractAddress, contract] = contractEntry as [`0x${string}`, typeof exportData.contracts[`0x${string}`]]

        // Find the function in the ABI
        const fn = findFunction(exportData, contractAddress, params.functionName)

        if (!fn) {
          return {
            success: false,
            error: `Function ${params.functionName} not found in contract`,
          }
        }

        // For view/pure functions, use free eth_call (no gas needed)
        if (isReadOnly(fn)) {
          const calldata = encodeContractCall(contract.abi, params.functionName, params.args)

          const result = await publicClient.call({
            to: contractAddress,
            data: calldata,
          })

          // Decode the result
          let decodedResult: unknown
          try {
            decodedResult = decodeFunctionResult({
              abi: contract.abi,
              functionName: params.functionName,
              data: result.data!,
            })
          } catch {
            decodedResult = result.data
          }

          return {
            success: true,
            readResult: serializeBigInts(decodedResult),
          }
        }

        // For write functions, route through executor
        const executeParams: ExecuteParams = {
          contractAddress,
          functionName: params.functionName,
          args: params.args,
          value: params.value,
        }

        const tx = buildTransaction(exportData, agentId, executeParams)
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
