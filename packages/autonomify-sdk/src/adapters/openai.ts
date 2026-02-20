import { zodToJsonSchema } from "zod-to-json-schema"
import type { ToolConfig, StructuredCall, ExecuteResult } from "../types"
import { executeCall } from "../tool/handler"
import { executeSchema } from "../tool/schema"
import { buildPrompt } from "../tool"

export interface OpenAIToolDef {
  type: "function"
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface OpenAIToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

export function createOpenAITool(config: ToolConfig) {
  const toolDef: OpenAIToolDef = {
    type: "function",
    function: {
      name: "autonomify_execute",
      description: "Execute a smart contract function",
      parameters: zodToJsonSchema(executeSchema) as Record<string, unknown>,
    },
  }

  const handler = async (toolCall: OpenAIToolCall): Promise<ExecuteResult> => {
    const params = JSON.parse(toolCall.function.arguments) as StructuredCall
    return executeCall(config, params)
  }

  return {
    tools: [toolDef],
    handler,
    prompt: buildPrompt(config.export),
  }
}

export function forOpenAI(config: ToolConfig) {
  return createOpenAITool(config)
}
