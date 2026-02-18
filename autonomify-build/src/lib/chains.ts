import type { ChainConfig } from "./types"

export const bscTestnet: ChainConfig = {
  id: 97,
  name: "BSC Testnet",
  rpc: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
  explorer: "https://testnet.bscscan.com",
  explorerApi: "https://api-testnet.bscscan.com/api",
  explorerApiKey: process.env.BSCSCAN_API_KEY,
}

export const chains: Record<string, ChainConfig> = {
  bscTestnet,
}

export function getChain(chainId: string): ChainConfig | undefined {
  return chains[chainId]
}
