/**
 * Export Generator
 *
 * Generates AutonomifyExport JSON from resolved contracts.
 */

import type { Abi } from "viem"
import type { ContractContext, ChainConfig } from "./types"
import type { AutonomifyExport, ContractExport, FunctionExport } from "autonomify-sdk"

// AutonomifyExecutor contract details
const EXECUTOR_ADDRESS = "0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C" as const

const EXECUTOR_ABI = [
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
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "computeNextNullifier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "event",
    name: "Executed",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "target", type: "address", indexed: true },
      { name: "selector", type: "bytes4", indexed: true },
      { name: "nullifier", type: "bytes32", indexed: false },
      { name: "success", type: "bool", indexed: false },
      { name: "returnData", type: "bytes", indexed: false },
    ],
  },
] as const

/**
 * Convert ContractContext to ContractExport format
 */
function toContractExport(contract: ContractContext): ContractExport {
  const functions: FunctionExport[] = contract.functions.map((fn) => ({
    name: fn.name,
    signature: fn.signature,
    stateMutability: fn.stateMutability,
    inputs: fn.inputs.map((i) => ({
      name: i.name || "",
      type: i.type as string,
    })),
    outputs: fn.outputs.map((o) => ({
      name: o.name || "",
      type: o.type as string,
    })),
  }))

  return {
    name: (contract.metadata.name as string) || "Unknown Contract",
    abi: contract.abi,
    metadata: contract.metadata,
    functions,
  }
}

/**
 * Generate AutonomifyExport from a list of contracts
 */
export function generateExport(
  chain: ChainConfig,
  contracts: ContractContext[]
): AutonomifyExport {
  const contractsMap: Record<`0x${string}`, ContractExport> = {}

  for (const contract of contracts) {
    contractsMap[contract.address as `0x${string}`] = toContractExport(contract)
  }

  return {
    version: "1.0",
    executor: {
      address: EXECUTOR_ADDRESS,
      abi: EXECUTOR_ABI as unknown as Abi,
    },
    chain: {
      id: chain.id,
      name: chain.name,
      rpc: chain.rpc,
    },
    contracts: contractsMap,
  }
}

/**
 * Get the executor address for a chain
 */
export function getExecutorAddress(chainId: number): `0x${string}` | undefined {
  // Currently only deployed on BSC Testnet
  if (chainId === 97) {
    return EXECUTOR_ADDRESS
  }
  return undefined
}

/**
 * Get executor ABI
 */
export function getExecutorAbi() {
  return EXECUTOR_ABI
}
