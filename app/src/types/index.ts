import type { FunctionExport } from "autonomify-sdk"

export type AgentType = "telegram" | "discord" | "self_hosted"

export interface ContractAnalysis {
  summary: string
  contractType: string
  capabilities: string[]
  functionDescriptions: Record<string, string>
}

export interface ContractData {
  address: string
  chain: string
  chainId: number
  metadata: Record<string, unknown>
  functions: FunctionExport[]
  analysis?: ContractAnalysis
}

export interface AgentData {
  id: string
  name: string
  type: AgentType
  walletAddress?: string
  agentIdBytes?: string
  contractCount: number
}

export interface PolicyData {
  maxTxAmount: string
  enableTimeWindow: boolean
  startHour: number
  endHour: number
  whitelistedContracts: { address: string; name: string | null }[]
  syncStatus: string
  lastSyncedAt: number | null
}
