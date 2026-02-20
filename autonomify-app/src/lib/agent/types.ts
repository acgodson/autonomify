/**
 * Agent Types
 *
 * Core types for all agent implementations.
 * Channel-agnostic - same agent can work on Telegram, Discord, etc.
 */

import type { Abi } from "viem"
import type { Chain, FunctionExport } from "autonomify-sdk"

// Re-export SDK types for convenience
export type { Chain, FunctionExport } from "autonomify-sdk"

export type ChannelType = "telegram" | "discord" | "self_hosted"

// Legacy type alias for backwards compatibility
export type AgentType = ChannelType

// API Response wrapper (used across all API routes)
export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

export interface AgentWallet {
  address: string
  privyWalletId: string
}

export interface AgentContract {
  address: string
  chainId: number
  chain: Chain
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

export interface Agent {
  id: string
  name: string
  channel: ChannelType
  // For hosted agents (telegram, discord)
  channelToken?: string // Telegram bot token, Discord bot token, etc.
  wallet?: AgentWallet
  // For self-hosted agents
  agentIdBytes?: string // bytes32 for AutonomifyExecutor
  // Common
  contracts: AgentContract[]
  createdAt: number
}

export interface ExecuteParams {
  contractAddress: string
  functionName: string
  args: Record<string, unknown>
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
