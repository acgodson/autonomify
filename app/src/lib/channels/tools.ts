import { tool } from "ai"
import { z } from "zod"
import {
  forVercelAI,
  buildTransaction,
  getExplorerUrl,
  type AutonomifyExport,
} from "autonomify-sdk"
import {
  triggerCRE,
  type CREResult,
  type CRESimulationResult,
  type CREExecutionResult,
} from "@/lib/agent"

export interface ToolContext {
  exportData: AutonomifyExport
  agentIdBytes: string
  ownerAddress: string
  signedDelegation: string
  chainId: number
  rpcUrl: string
}

export function formatCREError(result: CREResult): string {
  if (!result.error) return "Unknown error"

  if (result.mode === "simulation") {
    const simError = result.error as CRESimulationResult["error"]
    if (simError?.type === "infrastructure") {
      return simError.recommendation || `Infrastructure error: ${simError.decoded || simError.errorSelector}`
    }
    if (simError?.type === "target") {
      return `Contract error: ${simError.decoded || simError.errorSelector || "execution reverted"}`
    }
    return simError?.recommendation || simError?.decoded || "Simulation failed"
  }

  const execError = result.error as CREExecutionResult["error"]
  if (execError?.type === "infrastructure") {
    return execError.recommendation || `Infrastructure error at ${execError.contract}: ${execError.errorName}`
  }
  if (execError?.type === "target") {
    return `Contract error at ${execError.contract}.${execError.function || "unknown"}`
  }
  return typeof result.error === "string" ? result.error : "Execution failed"
}

export function createAgentTools(ctx: ToolContext) {
  const { tool: executeTool } = forVercelAI({
    export: ctx.exportData,
    agentId: ctx.agentIdBytes,
    submitTx: async (tx: any) => {
      const result = await triggerCRE({
        userAddress: ctx.ownerAddress,
        agentId: ctx.agentIdBytes,
        target: tx.to,
        calldata: tx.data,
        value: tx.value?.toString() || "0",
        permissionsContext: ctx.signedDelegation,
        simulateOnly: false,
      })

      if (!result.success) {
        throw new Error(formatCREError(result))
      }

      if (result.mode !== "execution") {
        throw new Error("Unexpected simulation result")
      }

      const explorerUrl = result.txHash ? getExplorerUrl(ctx.chainId, result.txHash) : null
      return explorerUrl ? `${result.txHash} (view: ${explorerUrl})` : result.txHash || ""
    },
  })

  const simulateTool = tool({
    description: `Simulate a transaction WITHOUT executing. Use when user says "simulate", "test", "dry run", or "check if this would work".`,
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).describe("Named arguments"),
      value: z.string().optional().describe("Native token value in ETH"),
    }),
    execute: async ({ contractAddress, functionName, args, value }) => {
      const contractKey = contractAddress.toLowerCase() as `0x${string}`
      const contractData = ctx.exportData.contracts[contractKey]

      if (!contractData) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const fn = contractData.functions.find((f: any) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      const tx = buildTransaction(ctx.exportData, ctx.agentIdBytes, {
        contractAddress: contractKey,
        functionName,
        args: Object.values(args),
        value,
      })

      const result = await triggerCRE({
        userAddress: ctx.ownerAddress,
        agentId: ctx.agentIdBytes,
        target: tx.to,
        calldata: tx.data,
        value: tx.value?.toString() || "0",
        permissionsContext: ctx.signedDelegation,
        simulateOnly: true,
      })

      if (result.mode !== "simulation") {
        return { success: false, error: "Unexpected execution result" }
      }

      const simResult = result as CRESimulationResult
      if (!simResult.success) {
        return {
          success: false,
          wouldSucceed: false,
          error: formatCREError(result),
          gasEstimate: simResult.gasEstimate,
        }
      }

      return {
        success: true,
        wouldSucceed: true,
        gasEstimate: simResult.gasEstimate,
        message: "Simulation passed - transaction would succeed. Ask user to confirm before executing.",
      }
    },
  })

  const balanceTool = tool({
    description: "Get native token balance of a wallet address.",
    parameters: z.object({
      address: z.string().describe("Wallet address to check"),
    }),
    execute: async ({ address }) => {
      const { getNativeBalance } = await import("@/lib/agent")
      return getNativeBalance(ctx.chainId, ctx.rpcUrl, address)
    },
  })

  return {
    autonomify_execute: executeTool,
    autonomify_simulate: simulateTool,
    get_native_balance: balanceTool,
  }
}
