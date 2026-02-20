/**
 * Chain Configuration
 *
 * Chain registry. To add a new chain:
 * 1. Add the chain config to CHAINS below
 * 2. Add executor address to ../core/executor.ts (once deployed)
 *
 * The app will automatically:
 * - Show the chain in dropdowns
 * - Use the correct explorer API
 * - Route transactions correctly
 */

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

  contracts?: {
    multicall3?: `0x${string}`
  }
}


export const CHAINS: Record<number, Chain> = {
  // ---------------------------------------------------------------------------
  // TESTNETS
  // ---------------------------------------------------------------------------
  97: {
    id: 97,
    name: "BNB Smart Chain Testnet",
    shortName: "BSC Testnet",
    testnet: true,
    rpc: [
      "https://data-seed-prebsc-1-s1.binance.org:8545",
      "https://data-seed-prebsc-2-s1.binance.org:8545",
    ],
    blockTime: 3,
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    wrappedNative: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    explorer: {
      name: "BscScan Testnet",
      url: "https://testnet.bscscan.com",
      apiUrl: "https://api-testnet.bscscan.com/api",
      type: "etherscan",
      apiKeyEnvVar: "BSCSCAN_API_KEY",
    },
  },

  11155111: {
    id: 11155111,
    name: "Sepolia",
    shortName: "Sepolia",
    testnet: true,
    rpc: [
      "https://rpc.sepolia.org",
      "https://ethereum-sepolia.publicnode.com",
    ],
    blockTime: 12,
    nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
    wrappedNative: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    explorer: {
      name: "Etherscan Sepolia",
      url: "https://sepolia.etherscan.io",
      apiUrl: "https://api-sepolia.etherscan.io/api",
      type: "etherscan",
      apiKeyEnvVar: "ETHERSCAN_API_KEY",
    },
  },

  80002: {
    id: 80002,
    name: "Polygon Amoy",
    shortName: "Amoy",
    testnet: true,
    rpc: [
      "https://rpc-amoy.polygon.technology",
      "https://polygon-amoy.publicnode.com",
    ],
    blockTime: 2,
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    wrappedNative: "0x0000000000000000000000000000000000000000", // TODO: add wrapped native
    explorer: {
      name: "PolygonScan Amoy",
      url: "https://amoy.polygonscan.com",
      apiUrl: "https://api-amoy.polygonscan.com/api",
      type: "etherscan",
      apiKeyEnvVar: "POLYGONSCAN_API_KEY",
    },
  },

  421614: {
    id: 421614,
    name: "Arbitrum Sepolia",
    shortName: "Arb Sepolia",
    testnet: true,
    rpc: [
      "https://sepolia-rollup.arbitrum.io/rpc",
      "https://arbitrum-sepolia.publicnode.com",
    ],
    blockTime: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0x0000000000000000000000000000000000000000", // TODO: add wrapped native
    explorer: {
      name: "Arbiscan Sepolia",
      url: "https://sepolia.arbiscan.io",
      apiUrl: "https://api-sepolia.arbiscan.io/api",
      type: "etherscan",
      apiKeyEnvVar: "ARBISCAN_API_KEY",
    },
  },

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
  },

  // ---------------------------------------------------------------------------
  // MAINNETS
  // ---------------------------------------------------------------------------
  1: {
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    testnet: false,
    rpc: [
      "https://eth.llamarpc.com",
      "https://ethereum.publicnode.com",
    ],
    blockTime: 12,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    explorer: {
      name: "Etherscan",
      url: "https://etherscan.io",
      apiUrl: "https://api.etherscan.io/api",
      type: "etherscan",
      apiKeyEnvVar: "ETHERSCAN_API_KEY",
    },
    contracts: {
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },

  56: {
    id: 56,
    name: "BNB Smart Chain",
    shortName: "BSC",
    testnet: false,
    rpc: [
      "https://bsc-dataseed.binance.org",
      "https://bsc-dataseed1.defibit.io",
    ],
    blockTime: 3,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    explorer: {
      name: "BscScan",
      url: "https://bscscan.com",
      apiUrl: "https://api.bscscan.com/api",
      type: "etherscan",
      apiKeyEnvVar: "BSCSCAN_API_KEY",
    },
    contracts: {
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },

  137: {
    id: 137,
    name: "Polygon",
    shortName: "MATIC",
    testnet: false,
    rpc: [
      "https://polygon-rpc.com",
      "https://polygon.llamarpc.com",
    ],
    blockTime: 2,
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    explorer: {
      name: "PolygonScan",
      url: "https://polygonscan.com",
      apiUrl: "https://api.polygonscan.com/api",
      type: "etherscan",
      apiKeyEnvVar: "POLYGONSCAN_API_KEY",
    },
    contracts: {
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },

  42161: {
    id: 42161,
    name: "Arbitrum One",
    shortName: "ARB",
    testnet: false,
    rpc: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum.llamarpc.com",
    ],
    blockTime: 1,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    explorer: {
      name: "Arbiscan",
      url: "https://arbiscan.io",
      apiUrl: "https://api.arbiscan.io/api",
      type: "etherscan",
      apiKeyEnvVar: "ARBISCAN_API_KEY",
    },
    contracts: {
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },

  8453: {
    id: 8453,
    name: "Base",
    shortName: "BASE",
    testnet: false,
    rpc: [
      "https://mainnet.base.org",
      "https://base.llamarpc.com",
    ],
    blockTime: 2,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0x4200000000000000000000000000000000000006",
    explorer: {
      name: "BaseScan",
      url: "https://basescan.org",
      apiUrl: "https://api.basescan.org/api",
      type: "etherscan",
      apiKeyEnvVar: "BASESCAN_API_KEY",
    },
    contracts: {
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },

  10: {
    id: 10,
    name: "Optimism",
    shortName: "OP",
    testnet: false,
    rpc: [
      "https://mainnet.optimism.io",
      "https://optimism.llamarpc.com",
    ],
    blockTime: 2,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0x4200000000000000000000000000000000000006",
    explorer: {
      name: "Optimism Etherscan",
      url: "https://optimistic.etherscan.io",
      apiUrl: "https://api-optimistic.etherscan.io/api",
      type: "etherscan",
      apiKeyEnvVar: "OPTIMISM_API_KEY",
    },
    contracts: {
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
    },
  },

  43114: {
    id: 43114,
    name: "Avalanche",
    shortName: "AVAX",
    testnet: false,
    rpc: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://avalanche.public-rpc.com",
    ],
    blockTime: 2,
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    wrappedNative: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    explorer: {
      name: "Snowtrace",
      url: "https://snowtrace.io",
      apiUrl: "https://api.snowtrace.io/api",
      type: "etherscan",
      apiKeyEnvVar: "SNOWTRACE_API_KEY",
    },
    contracts: {
      multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
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
