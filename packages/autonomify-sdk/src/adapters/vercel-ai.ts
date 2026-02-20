import { tool } from "ai"
import type { ToolConfig, AutonomifyExport, StructuredCall } from "../types"
import { executeCall } from "../tool/handler"
import { executeSchema } from "../tool/schema"
import { buildPrompt } from "../tool"

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

export function forVercelAI(config: ToolConfig) {
  return {
    tool: createVercelTool(config),
    prompt: buildPrompt(config.export),
  }
}

export { buildPrompt as buildSystemPrompt }
