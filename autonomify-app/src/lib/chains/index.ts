/**
 * Chain Configuration Module
 */

// =============================================================================
// DEFAULT CHAIN - Single source of truth
// =============================================================================

/**
 * Default chain ID used when no chain is specified.
 * Currently BSC Testnet (97) as it's the only chain with executor deployed.
 * Change this when deploying to other chains.
 */
export const DEFAULT_CHAIN_ID = 97

export {
  type Chain,
  type ChainSummary,
  type NetworkMode,
  type ExplorerType,
  // Chain registry
  CHAINS,
  chains,
  // Chain access
  getChain,
  getChainOrThrow,
  getChains,
  getMainnets,
  getTestnets,
  getChainIds,
  isChainSupported,
  isTestnet,
  // Explorer utilities
  getExplorerUrl,
  getAddressUrl,
  getTokenUrl,
  // RPC utilities
  getRpcUrl,
  getRpcUrls,
  // Chain summaries
  getChainSummary,
  getChainSummaries,
  // Executor
  isExecutorDeployed,
  getDeployedChainIds,
} from "autonomify-sdk"

import {
  type Chain,
  type NetworkMode,
  getChains,
  getChainOrThrow,
  isExecutorDeployed,
} from "autonomify-sdk"

// =============================================================================
// EXPLORER API KEY MANAGEMENT
// =============================================================================


export function getExplorerApiKey(chainId: number): string {
  const chain = getChainOrThrow(chainId)
  const envVar = chain.explorer.apiKeyEnvVar
  const apiKey = process.env[envVar]

  if (!apiKey) {
    throw new Error(
      `Missing API key for ${chain.name}. ` +
      `Set the ${envVar} environment variable.`
    )
  }
  return apiKey
}


export function hasExplorerApiKey(chainId: number): boolean {
  try {
    getExplorerApiKey(chainId)
    return true
  } catch {
    return false
  }
}


export interface ChainAvailability {
  chain: Chain
  executorDeployed: boolean
  apiKeyConfigured: boolean
  fullyReady: boolean
}


export function getChainsWithAvailability(mode: NetworkMode = "all"): ChainAvailability[] {
  return getChains(mode).map((chain) => {
    const executorDeployed = isExecutorDeployed(chain.id)
    const apiKeyConfigured = hasExplorerApiKey(chain.id)
    return {
      chain,
      executorDeployed,
      apiKeyConfigured,
      fullyReady: executorDeployed && apiKeyConfigured,
    }
  })
}


export function getReadyChains(mode: NetworkMode = "all"): Chain[] {
  return getChainsWithAvailability(mode)
    .filter((c) => c.fullyReady)
    .map((c) => c.chain)
}

export function getAvailableChains(mode: NetworkMode = "all"): Chain[] {
  return getChains(mode)
}


export function resolveChainId(param: string | number | undefined | null): number {
  // No param - error (don't silently default)
  if (param === undefined || param === null || param === "") {
    throw new Error("Chain ID is required")
  }

  // Already a number
  if (typeof param === "number") {
    return validateChainId(param)
  }

  // Try parsing as number
  const parsed = parseInt(param, 10)
  if (!isNaN(parsed)) {
    return validateChainId(parsed)
  }

  // Legacy name mapping (for backwards compatibility)
  const legacyNames: Record<string, number> = {
    // Testnets
    bscTestnet: 97,
    sepolia: 11155111,
    amoy: 80002,
    arbSepolia: 421614,
    baseSepolia: 84532,
    // Mainnets
    ethereum: 1,
    eth: 1,
    bsc: 56,
    bscMainnet: 56,
    polygon: 137,
    matic: 137,
    arbitrum: 42161,
    arb: 42161,
    base: 8453,
    optimism: 10,
    op: 10,
    avalanche: 43114,
    avax: 43114,
  }

  const chainId = legacyNames[param.toLowerCase()]
  if (chainId) {
    return validateChainId(chainId)
  }

  throw new Error(`Unknown chain: "${param}"`)
}

function validateChainId(chainId: number): number {
  // This will throw if chain doesn't exist
  getChainOrThrow(chainId)
  return chainId
}

/**
 * Resolve chain param with optional default (for backwards compatibility).
 * Use this only when you need to support legacy API behavior.
 */
export function resolveChainIdWithDefault(
  param: string | number | undefined | null,
  defaultChainId: number
): number {
  if (param === undefined || param === null || param === "") {
    return defaultChainId
  }
  try {
    return resolveChainId(param)
  } catch {
    return defaultChainId
  }
}
