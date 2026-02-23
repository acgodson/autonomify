import { http, createConfig } from "wagmi"
import {
  mainnet,
  bsc,
  bscTestnet,
  polygon,
  arbitrum,
  base,
  optimism,
  avalanche,
  sepolia,
  polygonAmoy,
  arbitrumSepolia,
  baseSepolia,
} from "wagmi/chains"
import { injected } from "wagmi/connectors"

/**
 * Wagmi Configuration
 *
 * Supports all chains that Autonomify SDK supports.
 * Add new chains here when adding to the SDK.
 */

// Testnets
const testnets = [
  bscTestnet,
  sepolia,
  polygonAmoy,
  arbitrumSepolia,
  baseSepolia,
] as const

// Mainnets
const mainnets = [
  mainnet,
  bsc,
  polygon,
  arbitrum,
  base,
  optimism,
  avalanche,
] as const

// All supported chains
const allChains = [...testnets, ...mainnets] as const

export const config = createConfig({
  chains: allChains,
  connectors: [
    injected(),
  ],
  transports: {
    // Testnets
    [bscTestnet.id]: http(),
    [sepolia.id]: http(),
    [polygonAmoy.id]: http(),
    [arbitrumSepolia.id]: http(),
    [baseSepolia.id]: http(),
    // Mainnets
    [mainnet.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [optimism.id]: http(),
    [avalanche.id]: http(),
  },
})

declare module "wagmi" {
  interface Register {
    config: typeof config
  }
}
