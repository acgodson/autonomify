import { http, createConfig } from "wagmi"
import { bscTestnet } from "wagmi/chains"
import { injected } from "wagmi/connectors"

export const config = createConfig({
  chains: [bscTestnet],
  connectors: [
    injected(),
  ],
  transports: {
    [bscTestnet.id]: http(),
  },
})

declare module "wagmi" {
  interface Register {
    config: typeof config
  }
}
