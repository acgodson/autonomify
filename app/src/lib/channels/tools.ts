import { tool } from "ai"
import { z } from "zod"
import { encodeFunctionData, getAddress, type Abi } from "viem"
import {
  forVercelAI,
  buildTransaction,
  getExplorerUrl,
  argsToArray,
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
  // Import SDK read-only helpers
  const { prompt } = forVercelAI({
    export: ctx.exportData,
    agentId: ctx.agentIdBytes,
    rpcUrl: ctx.rpcUrl,
    submitTx: async () => "", // Not used - we handle write txs manually
  })

  // Helper to check if a function is read-only
  const isReadOnly = (fn: { stateMutability: string }) =>
    fn.stateMutability === "view" || fn.stateMutability === "pure"

  // Execute tool - handles both read and write operations
  // For write operations, we pass RAW calldata to CRE (not executor-wrapped)
  const executeTool = tool({
    description: `Execute a smart contract function via Autonomify.`,
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).default({}).describe("Named arguments as object"),
      value: z.string().optional().describe("Native token value in ETH"),
    }),
    execute: async ({ contractAddress, functionName, args = {}, value }) => {
      const contractKey = contractAddress.toLowerCase() as `0x${string}`
      const contractData = ctx.exportData.contracts[contractKey]

      if (!contractData) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const fn = contractData.functions.find((f: any) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      // Normalize args (addresses, etc.)
      const normalizedArgs = Object.entries(args).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)

      const argsArray = argsToArray(ctx.exportData, contractKey, functionName, normalizedArgs)

      // Quoter functions are technically nonpayable but should be called as read-only
      const isQuoterFunction = functionName.startsWith("quote")
      if (isReadOnly(fn) || isQuoterFunction) {
        // Read-only call - use RPC directly
        const { createPublicClient, http, formatUnits } = await import("viem")
        const client = createPublicClient({ transport: http(ctx.rpcUrl) })

        try {
          const result = await client.readContract({
            address: contractKey,
            abi: contractData.abi as Abi,
            functionName,
            args: argsArray,
          })

          if (functionName === "balanceOf" && typeof result === "bigint") {
            const decimals = (contractData.metadata?.decimals as number) || 18
            const symbol = (contractData.metadata?.symbol as string) || "tokens"
            const formatted = formatUnits(result, decimals)
            return { success: true, result: `${formatted} ${symbol}`, raw: result.toString() }
          }

          // Serialize bigints
          const serialize = (val: unknown): unknown => {
            if (typeof val === "bigint") return val.toString()
            if (Array.isArray(val)) return val.map(serialize)
            if (val && typeof val === "object") {
              const obj: Record<string, unknown> = {}
              for (const [k, v] of Object.entries(val)) {
                obj[k] = serialize(v)
              }
              return obj
            }
            return val
          }

          return { success: true, result: serialize(result) }
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : "Read failed" }
        }
      }

      // Write function - encode RAW calldata (NOT executor-wrapped)
      const calldata = encodeFunctionData({
        abi: contractData.abi as Abi,
        functionName,
        args: argsArray,
      })

      console.log(`[CRE] Executing ${functionName} on ${contractKey.slice(0, 10)}...`)
      console.log(`[CRE] Calldata: ${calldata.slice(0, 20)}...`)

      // Pass raw target and calldata to CRE - it will handle executor wrapping
      const result = await triggerCRE({
        userAddress: ctx.ownerAddress,
        agentId: ctx.agentIdBytes,
        target: contractKey,  // Token address directly, NOT executor
        calldata,             // Raw transfer calldata, NOT executor-wrapped
        value: "0",
        permissionsContext: ctx.signedDelegation,
        simulateOnly: false,
      })

      console.log(`[CRE] Result: ${JSON.stringify(result)}`)

      if (!result.success) {
        return { success: false, error: formatCREError(result) }
      }

      if (result.mode !== "execution") {
        return { success: false, error: "Unexpected simulation result" }
      }

      const explorerUrl = result.txHash ? getExplorerUrl(ctx.chainId, result.txHash) : null
      return {
        success: true,
        txHash: result.txHash,
        explorerUrl,
        message: "Transaction executed",
      }
    },
  })

  const simulateTool = tool({
    description: `Simulate a WRITE transaction WITHOUT executing. Use when user says "simulate", "test", "dry run", or "check if this would work" for transfers, swaps, or approvals. Do NOT use for quotes - use autonomify_execute for quoteExactInputSingle.`,
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).default({}).describe("Named arguments as object"),
      value: z.string().optional().describe("Native token value in ETH"),
    }),
    execute: async ({ contractAddress, functionName, args = {}, value }) => {
      const contractKey = contractAddress.toLowerCase() as `0x${string}`
      const contractData = ctx.exportData.contracts[contractKey]

      if (!contractData) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const fn = contractData.functions.find((f: any) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      // Normalize args
      const normalizedArgs = Object.entries(args).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)

      const argsArray = argsToArray(ctx.exportData, contractKey, functionName, normalizedArgs)

      // Encode RAW calldata (NOT executor-wrapped)
      const calldata = encodeFunctionData({
        abi: contractData.abi as Abi,
        functionName,
        args: argsArray,
      })

      // Pass raw target and calldata to CRE for simulation
      const result = await triggerCRE({
        userAddress: ctx.ownerAddress,
        agentId: ctx.agentIdBytes,
        target: contractKey,  // Token address directly
        calldata,             // Raw calldata
        value: "0",
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

  return {
    autonomify_execute: executeTool,
    autonomify_simulate: simulateTool,
  }
}
