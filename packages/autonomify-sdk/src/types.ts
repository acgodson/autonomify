import type { Abi } from "viem"

export interface ChainConfig {
  id: number
  name: string
  rpc: string
}

export interface FunctionParam {
  name: string
  type: string
}

export interface FunctionExport {
  name: string
  signature: string
  stateMutability: "pure" | "view" | "nonpayable" | "payable"
  inputs: FunctionParam[]
  outputs: FunctionParam[]
}

export interface ContractExport {
  name: string
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

export interface AutonomifyExport {
  version: string
  executor: {
    address: `0x${string}`
    abi: Abi
  }
  chain: ChainConfig
  contracts: Record<`0x${string}`, ContractExport>
  agentId?: string
  agentName?: string
}

export interface ExecuteParams {
  contractAddress: `0x${string}`
  functionName: string
  args: unknown[]
  value?: string
}

export interface UnsignedTransaction {
  to: `0x${string}`
  data: `0x${string}`
  value: bigint
  chainId: number
}

export interface ExecuteResult {
  success: boolean
  txHash?: string
  readResult?: unknown
  error?: string
  simulationResult?: string
}

export type SignAndSendFn = (tx: UnsignedTransaction) => Promise<string>

export interface ToolConfig {
  export: AutonomifyExport
  agentId: string
  signAndSend: SignAndSendFn
  rpcUrl?: string
}

export interface StructuredCall {
  contractAddress: `0x${string}`
  functionName: string
  args: Record<string, unknown>
  value?: string
}
