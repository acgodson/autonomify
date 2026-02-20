/**
 * Autonomify Tool for OpenAI SDK
 *
 * Creates tool definitions compatible with OpenAI's function calling API.
 * Works with GPT-4, GPT-3.5, and other OpenAI-compatible APIs.
 *
 * @example
 * ```typescript
 * import { createOpenAITool, handleToolCall } from 'autonomify-sdk'
 * import OpenAI from 'openai'
 * import exportJson from './autonomify.json'
 *
 * const openai = new OpenAI()
 * const { tools, handler } = createOpenAITool({
 *   export: exportJson,
 *   agentId: '0x...',
 *   signAndSend: async (tx) => wallet.sendTransaction(tx)
 * })
 *
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Send 100 USDT to 0xABC' }],
 *   tools,
 * })
 *
 * // Handle tool calls
 * for (const toolCall of response.choices[0].message.tool_calls || []) {
 *   const result = await handler(toolCall)
 *   console.log(result)
 * }
 * ```
 */

import { createPublicClient, http, decodeFunctionResult, type AbiFunction } from "viem"
import { buildTransaction, encodeContractCall } from "./encoder"
import type {
  AutonomifyToolConfig,
  ExecuteParams,
  ExecuteResult,
  AutonomifyExport,
} from "./types"

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
 * OpenAI tool definition format
 */
export interface OpenAITool {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, unknown>
      required: string[]
    }
  }
}

/**
 * OpenAI tool call format
 */
export interface OpenAIToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

/**
 * Result of createOpenAITool
 */
export interface OpenAIToolResult {
  tools: OpenAITool[]
  handler: (toolCall: OpenAIToolCall) => Promise<ExecuteResult>
}

/**
 * Create OpenAI-compatible tool definitions and handler
 *
 * Automatically routes:
 * - view/pure functions → free eth_call (no gas)
 * - nonpayable/payable functions → executor contract (requires gas)
 */
export function createOpenAITool(config: AutonomifyToolConfig): OpenAIToolResult {
  const { export: exportData, agentId, signAndSend } = config

  // Create public client for free read calls
  const publicClient = createPublicClient({
    transport: http(exportData.chain.rpc),
  })

  const contractList = Object.entries(exportData.contracts)
    .map(([addr, c]) => `${c.name} (${addr})`)
    .join(", ")

  const tools: OpenAITool[] = [
    {
      type: "function",
      function: {
        name: "autonomify_execute",
        description: `Execute a smart contract function via Autonomify. Available contracts: ${contractList}`,
        parameters: {
          type: "object",
          properties: {
            contractAddress: {
              type: "string",
              description: "The contract address to call",
            },
            functionName: {
              type: "string",
              description: "The function name to call",
            },
            args: {
              type: "array",
              items: {},
              description: "Function arguments in order",
            },
            value: {
              type: "string",
              description: "BNB to send (for payable functions), in ether units like '0.1'",
            },
          },
          required: ["contractAddress", "functionName", "args"],
        },
      },
    },
  ]

  const handler = async (toolCall: OpenAIToolCall): Promise<ExecuteResult> => {
    if (toolCall.function.name !== "autonomify_execute") {
      return {
        success: false,
        error: `Unknown tool: ${toolCall.function.name}`,
      }
    }

    try {
      const params = JSON.parse(toolCall.function.arguments)
      const contractAddress = params.contractAddress as `0x${string}`
      const contract = exportData.contracts[contractAddress]

      if (!contract) {
        return {
          success: false,
          error: `Contract ${contractAddress} not found in export`,
        }
      }

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
        const calldata = encodeContractCall(contract.abi, params.functionName, params.args || [])

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
          readResult: decodedResult,
        }
      }

      // For write functions, route through executor
      const executeParams: ExecuteParams = {
        contractAddress,
        functionName: params.functionName,
        args: params.args || [],
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
  }

  return { tools, handler }
}

