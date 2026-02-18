import { createPublicClient, http, type Abi, type AbiFunction } from "viem"
import type { ChainConfig, FunctionInfo } from "./types"

export async function resolveMetadata(
  chain: ChainConfig,
  address: string,
  abi: Abi
): Promise<Record<string, unknown>> {
  const client = createPublicClient({
    transport: http(chain.rpc),
  })

  const zeroParamViewFunctions = abi.filter(
    (item): item is AbiFunction =>
      item.type === "function" &&
      (item.stateMutability === "view" || item.stateMutability === "pure") &&
      item.inputs.length === 0
  )

  const metadata: Record<string, unknown> = {}

  const calls = zeroParamViewFunctions.map(async (fn) => {
    try {
      const result = await client.readContract({
        address: address as `0x${string}`,
        abi: [fn],
        functionName: fn.name,
      })
      return { name: fn.name, value: result }
    } catch {
      return { name: fn.name, value: null }
    }
  })

  const results = await Promise.all(calls)

  for (const { name, value } of results) {
    if (value !== null) {
      if (typeof value === "bigint") {
        metadata[name] = (value as bigint).toString()
      } else {
        metadata[name] = value
      }
    }
  }

  return metadata
}

export function extractFunctions(abi: Abi): FunctionInfo[] {
  return abi
    .filter((item): item is AbiFunction => item.type === "function")
    .map((fn) => {
      const inputTypes = fn.inputs.map((i) => i.type).join(",")
      const signature = `${fn.name}(${inputTypes})`

      return {
        name: fn.name,
        signature,
        abi: fn,
        stateMutability: fn.stateMutability,
        inputs: fn.inputs,
        outputs: fn.outputs,
      }
    })
}
