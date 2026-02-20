/**
 * Autonomify Encoder
 *
 * Encodes contract calls into calldata for AutonomifyExecutor.
 * Pure encoding logic - no wallet dependencies.
 */

import { encodeFunctionData, parseEther, toHex, padHex, type Abi } from "viem"
import type {
  AutonomifyExport,
  ExecuteParams,
  UnsignedTransaction,
} from "./types"

// AutonomifyExecutor.execute(bytes32 agentId, address target, bytes calldata data)
const EXECUTOR_EXECUTE_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "success", type: "bool" },
      { name: "result", type: "bytes" },
    ],
  },
] as const

/**
 * Parse stringified arrays that LLMs sometimes produce
 * e.g., "[\"0xabc\",\"0xdef\"]" → ["0xabc", "0xdef"]
 */
function parseStringifiedArray(value: unknown): unknown {
  if (typeof value !== "string") return value

  // Check if it looks like a stringified array
  const trimmed = value.trim()
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch {
      // Not valid JSON, return original
    }
  }
  return value
}

/**
 * Convert args to proper types based on ABI
 * Handles string numbers → BigInt for uint/int types
 * Handles stringified arrays → actual arrays (LLM quirk)
 */
function convertArgs(abi: Abi, functionName: string, args: unknown[]): unknown[] {
  const fn = abi.find(
    (item) => item.type === "function" && "name" in item && item.name === functionName
  )
  if (!fn || fn.type !== "function" || !("inputs" in fn)) return args

  return args.map((arg, i) => {
    const input = fn.inputs[i]
    if (!input) return arg

    // First, parse any stringified arrays (LLM quirk)
    let processedArg = parseStringifiedArray(arg)

    // For array types, ensure we have an array and parse nested stringified arrays
    if (input.type.endsWith("[]")) {
      if (Array.isArray(processedArg)) {
        // Parse any stringified elements within the array
        processedArg = processedArg.map(parseStringifiedArray)
      }
    }

    // Convert string numbers to BigInt for uint/int types
    if (input.type.startsWith("uint") || input.type.startsWith("int")) {
      if (typeof processedArg === "string" && /^\d+$/.test(processedArg)) {
        return BigInt(processedArg)
      }
      if (typeof processedArg === "number") {
        return BigInt(processedArg)
      }
    }

    return processedArg
  })
}

/**
 * Encode a contract function call into calldata
 */
export function encodeContractCall(
  abi: Abi,
  functionName: string,
  args: unknown[]
): `0x${string}` {
  // Convert args to proper types (string amounts → BigInt)
  const convertedArgs = convertArgs(abi, functionName, args)

  return encodeFunctionData({
    abi,
    functionName,
    args: convertedArgs,
  })
}

/**
 * Convert string to bytes32 format using viem utilities
 * Handles: hex strings (0x...), UUIDs, and plain strings
 */
function toBytes32(value: string): `0x${string}` {
  // Already a proper 32-byte hex string
  if (value.startsWith("0x") && value.length === 66) {
    return value as `0x${string}`
  }

  // For UUIDs: remove dashes and use as hex (32 chars = 16 bytes)
  // Then pad to 32 bytes using viem's padHex
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    const hex = `0x${value.replace(/-/g, "")}` as `0x${string}`  // 16 bytes
    return padHex(hex, { size: 32, dir: "right" })  // Pad to 32 bytes
  }

  // For plain strings: convert to hex using viem's toHex, then pad
  const hex = toHex(value)
  return padHex(hex, { size: 32, dir: "right" })
}

/**
 * Encode a full AutonomifyExecutor.execute() call
 */
export function encodeExecutorCall(
  agentId: string,
  targetContract: `0x${string}`,
  calldata: `0x${string}`
): `0x${string}` {
  // Convert agentId to bytes32 format
  const agentIdBytes32 = toBytes32(agentId)

  return encodeFunctionData({
    abi: EXECUTOR_EXECUTE_ABI,
    functionName: "execute",
    args: [agentIdBytes32, targetContract, calldata],
  })
}

/**
 * Build an unsigned transaction from ExecuteParams
 * This is what gets passed to the user's signAndSend function
 */
export function buildTransaction(
  config: AutonomifyExport,
  agentId: string,  // UUID or hex string - will be converted to bytes32
  params: ExecuteParams
): UnsignedTransaction {
  const contract = config.contracts[params.contractAddress]
  if (!contract) {
    throw new Error(`Contract ${params.contractAddress} not found in export`)
  }

  // Encode the target contract call
  const targetCalldata = encodeContractCall(
    contract.abi,
    params.functionName,
    params.args
  )

  // Encode the executor call wrapping the target call
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

