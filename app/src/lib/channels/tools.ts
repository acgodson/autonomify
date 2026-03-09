import { tool } from "ai"
import { z } from "zod"
import { encodeFunctionData, getAddress, type Abi } from "viem"
import {
  forVercelAI,
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

function normalizeArgsForTuple(
  fn: { inputs: Array<{ name: string; type: string; components?: unknown[] }> },
  args: Record<string, unknown>,
  abi?: readonly unknown[]
): Record<string, unknown> {
  if (fn.inputs.length !== 1) return args

  const input = fn.inputs[0]
  if (input.type !== "tuple" || !input.name) return args
  if (args[input.name] !== undefined) return args

  let components = input.components as Array<{ name: string }> | undefined

  if (!components && abi) {
    const abiFunction = abi.find(
      (item: any) => item.type === "function" && item.name === fn.inputs[0]?.name
    ) as any
    if (!abiFunction) {
      const parentFn = abi.find(
        (item: any) => item.type === "function" &&
        item.inputs?.length === 1 &&
        item.inputs[0]?.type === "tuple" &&
        item.inputs[0]?.name === input.name
      ) as any
      if (parentFn?.inputs?.[0]?.components) {
        components = parentFn.inputs[0].components
      }
    }
  }

  if (!components) return args

  const componentNames = components.map(c => c.name).filter(Boolean)
  const hasComponentFields = componentNames.some(name => args[name] !== undefined)

  if (hasComponentFields) {
    console.log(`[Tools] Auto-wrapping args in "${input.name}" for tuple function`)
    return { [input.name]: args }
  }

  return args
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
  forVercelAI({
    export: ctx.exportData,
    agentId: ctx.agentIdBytes,
    rpcUrl: ctx.rpcUrl,
    submitTx: async () => "",
  })

  const isReadOnly = (fn: { stateMutability: string }) =>
    fn.stateMutability === "view" || fn.stateMutability === "pure"

  const executeTool = tool({
    description: `Execute a smart contract function via Autonomify.`,
    parameters: z.object({
      contractAddress: z.string().describe("Contract address (0x...)"),
      functionName: z.string().describe("Function name"),
      args: z.record(z.unknown()).default({}).describe("Named arguments as object"),
      value: z.string().optional().describe("Native token value in ETH"),
    }),
    execute: async ({ contractAddress, functionName, args = {} }) => {
      const contractKey = contractAddress.toLowerCase() as `0x${string}`
      const contractData = ctx.exportData.contracts[contractKey]

      if (!contractData) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const fn = contractData.functions.find((f: any) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      if (fn.inputs.length > 0 && Object.keys(args).length === 0) {
        const requiredParams = fn.inputs.map((i: any) => {
          if (i.type === "tuple" && i.components) {
            const fields = i.components.map((c: any) => c.name).join(", ")
            return `${i.name}: { ${fields} }`
          }
          return `${i.name} (${i.type})`
        }).join(", ")
        return {
          success: false,
          error: `Missing required arguments. This function needs: ${requiredParams}. Please provide all required parameters.`
        }
      }

      const wrappedArgs = normalizeArgsForTuple(fn, args, contractData.abi)

      const normalizedArgs = Object.entries(wrappedArgs).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)

      const argsArray = argsToArray(ctx.exportData, contractKey, functionName, normalizedArgs)

      const isQuoterFunction = functionName.startsWith("quote")
      if (isReadOnly(fn) || isQuoterFunction) {
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

      const calldata = encodeFunctionData({
        abi: contractData.abi as Abi,
        functionName,
        args: argsArray,
      })

      console.log(`[CRE] Executing ${functionName} on ${contractKey.slice(0, 10)}...`)
      console.log(`[CRE] Calldata: ${calldata.slice(0, 20)}...`)

      const result = await triggerCRE({
        userAddress: ctx.ownerAddress,
        agentId: ctx.agentIdBytes,
        target: contractKey,
        calldata,
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
    execute: async ({ contractAddress, functionName, args = {} }) => {
      const contractKey = contractAddress.toLowerCase() as `0x${string}`
      const contractData = ctx.exportData.contracts[contractKey]

      if (!contractData) {
        return { success: false, error: `Contract ${contractAddress} not found` }
      }

      const fn = contractData.functions.find((f: any) => f.name === functionName)
      if (!fn) {
        return { success: false, error: `Function ${functionName} not found` }
      }

      console.log(`[Simulate] Function ${functionName}:`, JSON.stringify(fn, null, 2))
      console.log(`[Simulate] Args before wrap:`, JSON.stringify(args, null, 2))

      if (fn.inputs.length > 0 && Object.keys(args).length === 0) {
        const requiredParams = fn.inputs.map((i: any) => {
          if (i.type === "tuple" && i.components) {
            const fields = i.components.map((c: any) => c.name).join(", ")
            return `${i.name}: { ${fields} }`
          }
          return `${i.name} (${i.type})`
        }).join(", ")
        return {
          success: false,
          error: `Missing required arguments. This function needs: ${requiredParams}. Please provide the swap parameters including tokenIn, tokenOut, amountIn, fee, recipient, amountOutMinimum, and sqrtPriceLimitX96.`
        }
      }

      const wrappedArgs = normalizeArgsForTuple(fn, args, contractData.abi)
      console.log(`[Simulate] Args after wrap:`, JSON.stringify(wrappedArgs, null, 2))

      const normalizedArgs = Object.entries(wrappedArgs).reduce((acc, [key, val]) => {
        if (typeof val === "string" && val.match(/^0x[a-fA-F0-9]{40}$/)) {
          acc[key] = getAddress(val)
        } else {
          acc[key] = val
        }
        return acc
      }, {} as Record<string, unknown>)

      const argsArray = argsToArray(ctx.exportData, contractKey, functionName, normalizedArgs)

      const calldata = encodeFunctionData({
        abi: contractData.abi as Abi,
        functionName,
        args: argsArray,
      })

      const result = await triggerCRE({
        userAddress: ctx.ownerAddress,
        agentId: ctx.agentIdBytes,
        target: contractKey,
        calldata,
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
