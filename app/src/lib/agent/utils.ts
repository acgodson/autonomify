/**
 * Agent Utilities
 *
 * Shared utility functions for working with agents and contracts.
 */

import type { Abi, AbiFunction } from "viem"
import type { Agent, AgentContract } from "./types"

/**
 * Find a contract in an agent by address.
 * Case-insensitive address matching.
 */
export function findContract(agent: Agent, address: string): AgentContract | undefined {
  return agent.contracts.find(
    (c) => c.address.toLowerCase() === address.toLowerCase()
  )
}

/**
 * Find a function in an ABI by name.
 * Returns properly typed AbiFunction or undefined.
 */
export function findAbiFunction(abi: Abi, functionName: string): AbiFunction | undefined {
  return abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && item.name === functionName
  )
}

/**
 * Get the primary chain ID from an agent's contracts.
 * Returns undefined if agent has no contracts.
 */
export function getAgentChainId(agent: Agent): number | undefined {
  return agent.contracts[0]?.chainId
}

/**
 * Check if an agent has contracts.
 */
export function hasContracts(agent: Agent): boolean {
  return agent.contracts.length > 0
}

/**
 * Check if an agent is fully configured (has wallet and contracts).
 */
export function isAgentReady(agent: Agent): boolean {
  return !!agent.wallet && agent.contracts.length > 0
}
