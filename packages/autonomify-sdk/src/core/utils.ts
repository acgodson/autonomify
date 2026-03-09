import { getAddress, isAddress } from "viem"
import type { AutonomifyExport, FunctionExport } from "../types"

export function findFunction(
  exportData: AutonomifyExport,
  contractAddress: `0x${string}`,
  functionName: string
): { contract: string; fn: FunctionExport; abi: readonly unknown[] } | null {
  const addr = contractAddress.toLowerCase() as `0x${string}`

  for (const [address, contract] of Object.entries(exportData.contracts)) {
    if (address.toLowerCase() === addr) {
      const fn = contract.functions.find((f) => f.name === functionName)
      if (fn) {
        return { contract: contract.name, fn, abi: contract.abi }
      }
    }
  }
  return null
}

export function isReadOnly(fn: FunctionExport): boolean {
  return fn.stateMutability === "view" || fn.stateMutability === "pure"
}

export function serializeBigInts(obj: unknown): unknown {
  if (typeof obj === "bigint") {
    return obj.toString()
  }
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInts)
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigInts(value)
    }
    return result
  }
  return obj
}

export function parseStringifiedArray(value: unknown): unknown {
  if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
  return value
}

export function normalizeAddress(address: string): `0x${string}` {
  // Use viem's getAddress to get proper checksum
  return getAddress(address) as `0x${string}`
}

/**
 * Recursively normalize address values in args based on ABI parameter types.
 * This ensures addresses pass viem's checksum validation.
 */
function normalizeAddressValues(value: unknown, paramType: string): unknown {
  // Handle address type
  if (paramType === "address" && typeof value === "string" && isAddress(value)) {
    return getAddress(value)
  }

  // Handle address arrays
  if (paramType === "address[]" && Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" && isAddress(v) ? getAddress(v) : v))
  }

  return value
}

export function argsToArray(
  exportData: AutonomifyExport,
  contractAddress: `0x${string}`,
  functionName: string,
  args: Record<string, unknown>
): unknown[] {
  const found = findFunction(exportData, contractAddress, functionName)
  if (!found) {
    throw new Error(`Function ${functionName} not found on ${contractAddress}`)
  }

  return found.fn.inputs.map((input, index) => {
    const name = input.name || `arg${index}`
    const value = args[name]
    if (value === undefined) {
      throw new Error(`Missing argument: ${name}`)
    }
    // Parse stringified arrays first, then normalize addresses
    const parsed = parseStringifiedArray(value)
    return normalizeAddressValues(parsed, input.type)
  })
}
