/**
 * Autonomify SDK Types
 *
 * Core types for the universal contract execution tool.
 */

import type { Abi } from "viem"

/**
 * Chain configuration
 */
export interface ChainConfig {
  id: number
  name: string
  rpc: string
}

/**
 * Function input/output parameter
 */
export interface FunctionParam {
  name: string
  type: string
}

/**
 * Contract function definition
 */
export interface FunctionExport {
  name: string
  signature: string
  stateMutability: "pure" | "view" | "nonpayable" | "payable"
  inputs: FunctionParam[]
  outputs: FunctionParam[]
}

/**
 * Contract export with ABI and metadata
 */
export interface ContractExport {
  name: string
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

/**
 * The main export format - everything needed to interact with contracts
 */
export interface AutonomifyExport {
  version: string
  executor: {
    address: `0x${string}`
    abi: Abi
  }
  chain: ChainConfig
  contracts: Record<`0x${string}`, ContractExport>
  // Optional agent info (added by /api/agents/[id]/export)
  agentId?: string
  agentName?: string
}

/**
 * Parameters for executing a contract function
 */
export interface ExecuteParams {
  contractAddress: `0x${string}`
  functionName: string
  args: unknown[]
  value?: string // ETH/BNB value in ether units (e.g., "0.1")
}

/**
 * Unsigned transaction to be signed by user's wallet
 */
export interface UnsignedTransaction {
  to: `0x${string}`
  data: `0x${string}`
  value: bigint
  chainId: number
}

/**
 * Result of an execution attempt
 */
export interface ExecuteResult {
  success: boolean
  txHash?: string
  error?: string
  simulationResult?: string
}

/**
 * Function to sign and send a transaction
 * User provides their own implementation with their wallet
 */
export type SignAndSendFn = (tx: UnsignedTransaction) => Promise<string>

/**
 * Configuration for creating an Autonomify tool
 */
export interface AutonomifyToolConfig {
  export: AutonomifyExport
  agentId: `0x${string}`
  signAndSend: SignAndSendFn
}
