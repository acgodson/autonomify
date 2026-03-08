import { tool } from "ai"
import type { ToolConfig, StructuredCall, SimulationResult } from "../types"
import { executeCall } from "../tool/handler"
import { executeSchema } from "../tool/schema"
import { buildPrompt } from "../tool"
import { buildTransaction } from "../core/encoder"
import { argsToArray } from "../core/utils"

export function createVercelTool(config: ToolConfig) {
  return tool({
    description: `Execute a smart contract function via Autonomify.

Arguments must be a named object matching the function's parameter names.

Example:
{
  "contractAddress": "0x...",
  "functionName": "transfer",
  "args": { "to": "0x...", "amount": "1000000000000000000" }
}`,
    parameters: executeSchema,
    execute: async (params): Promise<unknown> => {
      const result = await executeCall(config, params as StructuredCall)
      return result
    },
  })
}

export function createVercelSimulateTool(config: ToolConfig) {
  if (!config.simulateTx) {
    return null
  }

  return tool({
    description: `Simulate a smart contract transaction WITHOUT executing it. Use this when the user asks to "simulate", "test", "dry run", or "check if this would work". Returns estimated gas and whether the transaction would succeed.`,
    parameters: executeSchema,
    execute: async (params): Promise<SimulationResult> => {
      const call = params as StructuredCall
      const contractAddress = call.contractAddress.toLowerCase() as `0x${string}`
      const contractData = config.export.contracts[contractAddress]

      if (!contractData) {
        return {
          success: false,
          wouldSucceed: false,
          error: `Contract ${call.contractAddress} not found`,
        }
      }

      const fn = contractData.functions.find((f) => f.name === call.functionName)
      if (!fn) {
        return {
          success: false,
          wouldSucceed: false,
          error: `Function ${call.functionName} not found`,
        }
      }

      const argsArray = argsToArray(config.export, contractAddress, call.functionName, call.args)

      const tx = buildTransaction(config.export, config.agentId, {
        contractAddress,
        functionName: call.functionName,
        args: argsArray,
        value: call.value,
      })

      return config.simulateTx!(tx)
    },
  })
}

export function forVercelAI(config: ToolConfig) {
  const executeTool = createVercelTool(config)
  const simulateTool = createVercelSimulateTool(config)

  return {
    tool: executeTool,
    simulateTool,
    prompt: buildPrompt(config.export),
  }
}

export { buildPrompt as buildSystemPrompt }
