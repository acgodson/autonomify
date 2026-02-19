/**
 * Chain Configurations
 *
 * Defines supported blockchain networks for contract resolution.
 */

import type { ChainConfig } from "./types"

export const bscTestnet: ChainConfig = {
  id: 97,
  name: "BSC Testnet",
  rpc: process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545",
  explorer: "https://testnet.bscscan.com",
  explorerApi: "https://api-testnet.bscscan.com/api",
  explorerApiKey: process.env.BSCSCAN_API_KEY,
}

export const bscMainnet: ChainConfig = {
  id: 56,
  name: "BSC Mainnet",
  rpc: process.env.BSC_MAINNET_RPC || "https://bsc-dataseed1.binance.org",
  explorer: "https://bscscan.com",
  explorerApi: "https://api.bscscan.com/api",
  explorerApiKey: process.env.BSCSCAN_API_KEY,
}

export const chains: Record<string, ChainConfig> = {
  bscTestnet,
  bscMainnet,
}

export function getChain(chainId: string): ChainConfig | undefined {
  return chains[chainId]
}

export function getChainById(id: number): ChainConfig | undefined {
  return Object.values(chains).find((c) => c.id === id)
}
