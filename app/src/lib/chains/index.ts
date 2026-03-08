import {
  type Chain,
  type ChainSummary,
  type NetworkMode,
  type ExplorerType,
  CHAINS,
  chains,
  getChain,
  getChainOrThrow,
  getChains,
  getMainnets,
  getTestnets,
  getChainIds,
  isChainSupported,
  isTestnet,
  getExplorerUrl,
  getAddressUrl,
  getTokenUrl,
  getRpcUrl,
  getRpcUrls,
  getChainSummary,
  getChainSummaries,
  isExecutorDeployed,
  getDeployedChainIds,
} from "autonomify-sdk"

export const DEFAULT_CHAIN_ID = 84532

export type { Chain, ChainSummary, NetworkMode, ExplorerType }

export {
  CHAINS,
  chains,
  getChain,
  getChainOrThrow,
  getChains,
  getMainnets,
  getTestnets,
  getChainIds,
  isChainSupported,
  isTestnet,
  getExplorerUrl,
  getAddressUrl,
  getTokenUrl,
  getRpcUrl,
  getRpcUrls,
  getChainSummary,
  getChainSummaries,
  isExecutorDeployed,
  getDeployedChainIds,
}

export function getExplorerApiKey(chainId: number): string {
  const chain = getChainOrThrow(chainId)
  const envVar = chain.explorer.apiKeyEnvVar
  const apiKey = process.env[envVar]

  if (!apiKey) {
    throw new Error(
      `Missing API key for ${chain.name}. Set the ${envVar} environment variable.`
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
      fullyReady: executorDeployed,
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

const LEGACY_CHAIN_NAMES: Record<string, number> = {
  bscTestnet: 97,
  sepolia: 11155111,
  amoy: 80002,
  arbSepolia: 421614,
  baseSepolia: 84532,
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

export function resolveChainId(param: string | number | undefined | null): number {
  if (param === undefined || param === null || param === "") {
    throw new Error("Chain ID is required")
  }

  if (typeof param === "number") {
    return validateChainId(param)
  }

  const parsed = parseInt(param, 10)
  if (!isNaN(parsed)) {
    return validateChainId(parsed)
  }

  const chainId = LEGACY_CHAIN_NAMES[param.toLowerCase()]
  if (chainId) {
    return validateChainId(chainId)
  }

  throw new Error(`Unknown chain: "${param}"`)
}

function validateChainId(chainId: number): number {
  getChainOrThrow(chainId)
  return chainId
}

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
