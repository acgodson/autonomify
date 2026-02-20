/**
 * Contract Resolver
 *
 * Resolves contract metadata and functions from verified contracts.
 * Uses SDK types and chains as the source of truth.
 */

import { createPublicClient, http, type Abi, type AbiFunction, type AbiParameter } from "viem"
import { getChain, type Chain, type FunctionExport } from "autonomify-sdk"
import { fetchAbi, isValidAddress } from "./fetcher"

export interface ResolvedContract {
  address: string
  chainId: number
  chain: Chain
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

export async function resolveMetadata(
  chain: Chain,
  address: string,
  abi: Abi
): Promise<Record<string, unknown>> {
  const client = createPublicClient({
    transport: http(chain.rpc[0]),
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

export function extractFunctions(abi: Abi): FunctionExport[] {
  return abi
    .filter((item): item is AbiFunction => item.type === "function")
    .map((fn) => {
      const inputTypes = fn.inputs.map((i) => i.type).join(",")
      const signature = `${fn.name}(${inputTypes})`

      return {
        name: fn.name,
        signature,
        stateMutability: fn.stateMutability,
        inputs: fn.inputs.map((i) => ({
          name: i.name || "",
          type: i.type,
        })),
        outputs: fn.outputs?.map((o) => ({
          name: o.name || "",
          type: o.type,
        })) || [],
      }
    })
}

export interface ResolveContractOptions {
  chainId: number
  address: string
}

/**
 * Resolves a contract by fetching its ABI, extracting functions, and getting metadata.
 */
export async function resolveContract(
  options: ResolveContractOptions
): Promise<ResolvedContract> {
  const { chainId, address } = options

  if (!isValidAddress(address)) {
    throw new Error("Invalid contract address format")
  }

  const chain = getChain(chainId)
  if (!chain) {
    throw new Error(`Unknown chain ID: ${chainId}`)
  }

  const { abi } = await fetchAbi(chainId, address)
  const functions = extractFunctions(abi)
  const metadata = await resolveMetadata(chain, address, abi)

  return {
    address,
    chainId,
    chain,
    abi,
    metadata,
    functions,
  }
}

export { isValidAddress } from "./fetcher"
