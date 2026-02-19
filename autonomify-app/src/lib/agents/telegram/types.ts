/**
 * Agent Types
 *
 * Types for all agent implementations (Telegram, Discord, Self-Hosted).
 */

import type { ContractContext } from "@/lib/autonomify-core"

export type AgentType = "telegram" | "discord" | "self_hosted"

export interface AgentWallet {
  address: string
  privyWalletId: string
}

export interface AgentConfig {
  id: string
  name: string
  type: AgentType
  // For hosted agents (telegram, discord)
  telegramBotToken?: string
  wallet?: AgentWallet
  // For self-hosted agents
  agentIdBytes?: string // bytes32 for AutonomifyExecutor
  // Common
  contracts: ContractContext[]
  createdAt: number
}

export interface ExecuteParams {
  contractAddress: string
  functionName: string
  args: unknown[]
  value?: string
}

export interface SimulateResult {
  success: boolean
  gasEstimate?: string
  error?: string
  returnData?: unknown
}

export interface ExecuteResult {
  success: boolean
  txHash?: string
  explorerUrl?: string
  error?: string
}

export interface ExecuteViaExecutorParams {
  walletId: string
  agentId: string
  targetContract: string
  functionName: string
  functionAbi: unknown[]
  args: unknown[]
  value?: bigint
}
