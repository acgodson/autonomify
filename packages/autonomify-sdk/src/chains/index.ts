export type NetworkMode = "mainnet" | "testnet" | "all"

export type ExplorerType = "etherscan" | "blockscout"

export interface Chain {
  id: number
  name: string
  shortName: string
  testnet: boolean
  rpc: string[]
  blockTime: number
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  wrappedNative: `0x${string}`
  explorer: {
    name: string
    url: string
    apiUrl: string
    type: ExplorerType
    apiKeyEnvVar: string
  }
  tenderly?: {
    rpcEnvVar: string
    virtualTestnetRpcEnvVar: string
  }
  contracts?: {
    multicall3?: `0x${string}`
  }
}


export const CHAINS: Record<number, Chain> = {
  // Base Sepolia - Primary chain for hackathon
  84532: {
    id: 84532,
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    testnet: true,
    rpc: [
      "https://sepolia.base.org",
      "https://base-sepolia.publicnode.com",
    ],
    blockTime: 2,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0x4200000000000000000000000000000000000006",
    explorer: {
      name: "BaseScan Sepolia",
      url: "https://sepolia.basescan.org",
      apiUrl: "https://api-sepolia.basescan.org/api",
      type: "etherscan",
      apiKeyEnvVar: "BASESCAN_API_KEY",
    },
    tenderly: {
      rpcEnvVar: "TENDERLY_BASE_SEPOLIA_RPC",
      virtualTestnetRpcEnvVar: "TENDERLY_VIRTUAL_TESTNET_RPC",
    },
  },
}

export const chains = CHAINS

export function getChain(chainId: number): Chain | undefined {
  return CHAINS[chainId]
}

export function getChainOrThrow(chainId: number): Chain {
  const chain = CHAINS[chainId]
  if (!chain) {
    throw new Error(`Chain ${chainId} not configured. Add it to CHAINS in autonomify-sdk.`)
  }
  return chain
}

export function getChains(mode: NetworkMode = "all"): Chain[] {
  const all = Object.values(CHAINS)
  switch (mode) {
    case "mainnet":
      return all.filter((c) => !c.testnet)
    case "testnet":
      return all.filter((c) => c.testnet)
    case "all":
      return all
  }
}

export function getMainnets(): Chain[] {
  return getChains("mainnet")
}

export function getTestnets(): Chain[] {
  return getChains("testnet")
}

export function getChainIds(mode: NetworkMode = "all"): number[] {
  return getChains(mode).map((c) => c.id)
}

export function isChainSupported(chainId: number): boolean {
  return chainId in CHAINS
}

export function isTestnet(chainId: number): boolean {
  return CHAINS[chainId]?.testnet ?? false
}

export function getExplorerUrl(chainId: number, txHash: string): string | null {
  const chain = CHAINS[chainId]
  return chain ? `${chain.explorer.url}/tx/${txHash}` : null
}

export function getAddressUrl(chainId: number, address: string): string | null {
  const chain = CHAINS[chainId]
  return chain ? `${chain.explorer.url}/address/${address}` : null
}

export function getTokenUrl(chainId: number, address: string): string | null {
  const chain = CHAINS[chainId]
  return chain ? `${chain.explorer.url}/token/${address}` : null
}

export function getRpcUrl(chainId: number): string {
  const chain = getChainOrThrow(chainId)
  return chain.rpc[0]
}

export function getRpcUrls(chainId: number): string[] {
  const chain = getChainOrThrow(chainId)
  return [...chain.rpc]
}

export interface ChainSummary {
  id: number
  name: string
  shortName: string
  testnet: boolean
  nativeSymbol: string
  explorerUrl: string
}

export function getChainSummary(chainId: number): ChainSummary | undefined {
  const chain = CHAINS[chainId]
  if (!chain) return undefined

  return {
    id: chain.id,
    name: chain.name,
    shortName: chain.shortName,
    testnet: chain.testnet,
    nativeSymbol: chain.nativeCurrency.symbol,
    explorerUrl: chain.explorer.url,
  }
}


export function getChainSummaries(mode: NetworkMode = "all"): ChainSummary[] {
  return getChains(mode).map((chain) => ({
    id: chain.id,
    name: chain.name,
    shortName: chain.shortName,
    testnet: chain.testnet,
    nativeSymbol: chain.nativeCurrency.symbol,
    explorerUrl: chain.explorer.url,
  }))
}

export function getTenderlyRpc(chainId: number): string | null {
  const chain = CHAINS[chainId]
  if (!chain?.tenderly?.rpcEnvVar) return null
  return process.env[chain.tenderly.rpcEnvVar] ?? null
}

export function getVirtualTestnetRpc(chainId: number): string | null {
  const chain = CHAINS[chainId]
  if (!chain?.tenderly?.virtualTestnetRpcEnvVar) return null
  return process.env[chain.tenderly.virtualTestnetRpcEnvVar] ?? null
}

export function hasTenderlySupport(chainId: number): boolean {
  const chain = CHAINS[chainId]
  return !!chain?.tenderly
}

/**
 * Get the best RPC URL for a chain.
 * Prefers Tenderly RPC if available, falls back to public RPCs.
 */
export function getBestRpcUrl(chainId: number): string {
  const tenderlyRpc = getTenderlyRpc(chainId)
  if (tenderlyRpc) return tenderlyRpc
  return getRpcUrl(chainId)
}
