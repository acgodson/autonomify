export interface Chain {
  id: number
  name: string
  shortName: string
  rpc: string[]
  explorer: string
  explorerApi: string
  nativeCurrency: { name: string; symbol: string; decimals: number }
  wrappedNative: `0x${string}`
  testnet: boolean
}

export const chains: Record<number, Chain> = {
  97: {
    id: 97,
    name: "BNB Smart Chain Testnet",
    shortName: "BSC Testnet",
    rpc: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
    explorer: "https://testnet.bscscan.com",
    explorerApi: "https://api-testnet.bscscan.com/api",
    nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
    wrappedNative: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
    testnet: true,
  },
  56: {
    id: 56,
    name: "BNB Smart Chain",
    shortName: "BSC",
    rpc: ["https://bsc-dataseed.binance.org"],
    explorer: "https://bscscan.com",
    explorerApi: "https://api.bscscan.com/api",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    testnet: false,
  },
  1: {
    id: 1,
    name: "Ethereum",
    shortName: "ETH",
    rpc: ["https://eth.llamarpc.com"],
    explorer: "https://etherscan.io",
    explorerApi: "https://api.etherscan.io/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    testnet: false,
  },
  11155111: {
    id: 11155111,
    name: "Sepolia",
    shortName: "Sepolia",
    rpc: ["https://rpc.sepolia.org"],
    explorer: "https://sepolia.etherscan.io",
    explorerApi: "https://api-sepolia.etherscan.io/api",
    nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
    wrappedNative: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    testnet: true,
  },
  137: {
    id: 137,
    name: "Polygon",
    shortName: "MATIC",
    rpc: ["https://polygon-rpc.com"],
    explorer: "https://polygonscan.com",
    explorerApi: "https://api.polygonscan.com/api",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    testnet: false,
  },
  42161: {
    id: 42161,
    name: "Arbitrum One",
    shortName: "ARB",
    rpc: ["https://arb1.arbitrum.io/rpc"],
    explorer: "https://arbiscan.io",
    explorerApi: "https://api.arbiscan.io/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    testnet: false,
  },
  8453: {
    id: 8453,
    name: "Base",
    shortName: "BASE",
    rpc: ["https://mainnet.base.org"],
    explorer: "https://basescan.org",
    explorerApi: "https://api.basescan.org/api",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    wrappedNative: "0x4200000000000000000000000000000000000006",
    testnet: false,
  },
}

export function getChain(chainId: number): Chain | undefined {
  return chains[chainId]
}

export function getExplorerUrl(chainId: number, txHash: string): string | null {
  const chain = chains[chainId]
  return chain ? `${chain.explorer}/tx/${txHash}` : null
}

export function getAddressUrl(chainId: number, address: string): string | null {
  const chain = chains[chainId]
  return chain ? `${chain.explorer}/address/${address}` : null
}

export function getMainnets(): Chain[] {
  return Object.values(chains).filter((c) => !c.testnet)
}

export function getTestnets(): Chain[] {
  return Object.values(chains).filter((c) => c.testnet)
}
