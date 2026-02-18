import type { Abi, AbiFunction, AbiParameter } from "viem"

export interface ChainConfig {
  id: number
  name: string
  rpc: string
  explorer: string
  explorerApi: string
  explorerApiKey?: string
}

export interface FunctionInfo {
  name: string
  signature: string
  abi: AbiFunction
  stateMutability: "pure" | "view" | "nonpayable" | "payable"
  inputs: readonly AbiParameter[]
  outputs: readonly AbiParameter[]
}

export interface ContractContext {
  address: string
  chain: ChainConfig
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionInfo[]
}

export interface AgentWallet {
  address: string
  privateKey: string
}

export interface AgentConfig {
  id: string
  name: string
  telegramBotToken: string
  wallet: AgentWallet
  contracts: ContractContext[]
  createdAt: number
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
