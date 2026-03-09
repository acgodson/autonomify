import { encodeFunctionData, parseEther, type Abi, type AbiParameter } from "viem"
import type { AutonomifyExport, ExecuteParams, UnsignedTransaction } from "../types"
import { EXECUTOR_ABI, toBytes32 } from "./executor"
import { parseStringifiedArray } from "./utils"

/**
 * Recursively convert values to appropriate types based on ABI parameter types.
 * Handles nested tuples/structs and arrays.
 */
function convertValue(value: unknown, paramType: string, components?: readonly AbiParameter[]): unknown {
  let processed = parseStringifiedArray(value)

  // Handle arrays
  if (paramType.endsWith("[]")) {
    const baseType = paramType.slice(0, -2)
    if (Array.isArray(processed)) {
      return processed.map((item) => convertValue(item, baseType, components))
    }
    return processed
  }

  // Handle tuples (structs) - recursively process fields
  if (paramType === "tuple" && components && typeof processed === "object" && processed !== null) {
    const obj = processed as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const comp of components) {
      if (comp.name && obj[comp.name] !== undefined) {
        result[comp.name] = convertValue(
          obj[comp.name],
          comp.type,
          "components" in comp ? (comp.components as readonly AbiParameter[]) : undefined
        )
      }
    }
    return result
  }

  // Handle uint/int types - convert to BigInt
  if (paramType.startsWith("uint") || paramType.startsWith("int")) {
    if (typeof processed === "string" && /^\d+$/.test(processed)) {
      return BigInt(processed)
    }
    if (typeof processed === "number") {
      return BigInt(processed)
    }
  }

  return processed
}

function convertArgs(abi: Abi, functionName: string, args: unknown[]): unknown[] {
  const fn = abi.find(
    (item) => item.type === "function" && "name" in item && item.name === functionName
  )
  if (!fn || fn.type !== "function" || !("inputs" in fn)) return args

  return args.map((arg, i) => {
    const input = fn.inputs[i]
    if (!input) return arg

    return convertValue(
      arg,
      input.type,
      "components" in input ? (input.components as readonly AbiParameter[]) : undefined
    )
  })
}

export function encodeContractCall(
  abi: Abi,
  functionName: string,
  args: unknown[]
): `0x${string}` {
  const convertedArgs = convertArgs(abi, functionName, args)
  return encodeFunctionData({ abi, functionName, args: convertedArgs })
}

export function encodeExecutorCall(
  agentId: string,
  targetContract: `0x${string}`,
  calldata: `0x${string}`
): `0x${string}` {
  const agentIdBytes32 = toBytes32(agentId)
  return encodeFunctionData({
    abi: EXECUTOR_ABI,
    functionName: "execute",
    args: [agentIdBytes32, targetContract, calldata],
  })
}

export function buildTransaction(
  config: AutonomifyExport,
  agentId: string,
  params: ExecuteParams
): UnsignedTransaction {
  // Normalize address to lowercase for lookup (keys are lowercase)
  const normalizedAddress = params.contractAddress.toLowerCase() as `0x${string}`
  const contract = config.contracts[normalizedAddress]
  if (!contract) {
    throw new Error(`Contract ${params.contractAddress} not found in config`)
  }

  const targetCalldata = encodeContractCall(
    contract.abi,
    params.functionName,
    params.args
  )

  const executorCalldata = encodeExecutorCall(
    agentId,
    params.contractAddress,
    targetCalldata
  )

  return {
    to: config.executor.address,
    data: executorCalldata,
    value: params.value ? parseEther(params.value) : BigInt(0),
    chainId: config.chain.id,
  }
}
