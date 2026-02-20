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
  const clean = address.toLowerCase()
  if (!clean.startsWith("0x") || clean.length !== 42) {
    throw new Error(`Invalid address: ${address}`)
  }
  return clean as `0x${string}`
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
    return parseStringifiedArray(value)
  })
}
