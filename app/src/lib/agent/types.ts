import type { Abi } from "viem"
import type { Chain, FunctionExport } from "autonomify-sdk"

export type { Chain, FunctionExport } from "autonomify-sdk"
 
export type ChannelType = "telegram" | "discord" | "self_hosted"

export type AgentType = ChannelType

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface ContractAnalysis {
  name: string
  summary: string
  contractType: string
  capabilities: string[]
  functionDescriptions: Record<string, string>
}

export interface AgentContract {
  address: string
  chainId: number
  chain: Chain
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionExport[]
  analysis?: ContractAnalysis
}

export interface Agent {
  id: string
  name: string
  channel: ChannelType
  ownerAddress: string
  channelToken?: string
  agentIdBytes?: string
  contracts: AgentContract[]
  createdAt: number
}

export interface UserDelegation {
  userAddress: string
  delegationHash: string
  signedDelegation: string
  executorAddress: string
  chainId: number
}

export interface AgentPolicy {
  agentId: string
  userAddress: string
  dailyLimit: string
  txLimit: string
  allowedContracts: string[]
  syncStatus: "pending" | "synced" | "failed"
}

export interface ExecuteParams {
  contractAddress: string
  functionName: string
  args: Record<string, unknown>
  value?: string
}

export interface SimulateResult {
  success: boolean
  gasEstimate?: number
  error?: string
  returnData?: string
  nullifier?: string
  policySatisfied?: boolean
}

export interface ExecuteResult {
  success: boolean
  txHash?: string
  explorerUrl?: string
  nullifier?: string
  gasUsed?: number
  error?: string
}

export type ExecutionStatus = "pending" | "simulating" | "proving" | "executing" | "success" | "failed"

export interface ExecutionRecord {
  id: string
  agentId: string
  userAddress: string
  targetContract: string
  functionName: string
  status: ExecutionStatus
  txHash?: string
  nullifier?: string
  gasUsed?: number
  errorMessage?: string
  createdAt: number
  completedAt?: number
}
