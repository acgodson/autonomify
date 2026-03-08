import { zodToJsonSchema } from "zod-to-json-schema"
import type { ToolConfig, StructuredCall, ExecuteResult, SimulationResult } from "../types"
import { executeCall } from "../tool/handler"
import { executeSchema } from "../tool/schema"
import { buildPrompt } from "../tool"
import { buildTransaction } from "../core/encoder"
import { argsToArray } from "../core/utils"

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

export function createOpenAISimulateTool(config: ToolConfig) {
  if (!config.simulateTx) {
    return null
  }

  const toolDef: OpenAIToolDef = {
    type: "function",
    function: {
      name: "autonomify_simulate",
      description: `Simulate a smart contract transaction WITHOUT executing it. Use this when the user asks to "simulate", "test", "dry run", or "check if this would work". Returns estimated gas and whether the transaction would succeed.`,
      parameters: zodToJsonSchema(executeSchema) as Record<string, unknown>,
    },
  }

  const handler = async (toolCall: OpenAIToolCall): Promise<SimulationResult> => {
    const call = JSON.parse(toolCall.function.arguments) as StructuredCall
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
  }

  return {
    toolDef,
    handler,
  }
}

export function forOpenAI(config: ToolConfig) {
  const executeTool = createOpenAITool(config)
  const simulateTool = createOpenAISimulateTool(config)

  return {
    ...executeTool,
    tools: simulateTool
      ? [...executeTool.tools, simulateTool.toolDef]
      : executeTool.tools,
    simulateHandler: simulateTool?.handler,
  }
}
