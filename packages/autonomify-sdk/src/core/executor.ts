export const EXECUTOR_ADDRESSES: Record<number, `0x${string}`> = {
  97: "0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C",    // BSC Testnet
  56: "0x0000000000000000000000000000000000000000",    // BSC Mainnet (TODO: deploy)
  1: "0x0000000000000000000000000000000000000000",     // Ethereum (TODO: deploy)
  137: "0x0000000000000000000000000000000000000000",   // Polygon (TODO: deploy)
  42161: "0x0000000000000000000000000000000000000000", // Arbitrum (TODO: deploy)
  8453: "0x0000000000000000000000000000000000000000",  // Base (TODO: deploy)
}

export const EXECUTOR_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "target", type: "address" },
      { name: "callData", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    name: "getNonce",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "computeNextNullifier",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "bytes32" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    name: "Executed",
    type: "event",
    inputs: [
      { name: "agentId", type: "bytes32", indexed: true },
      { name: "nullifier", type: "bytes32", indexed: true },
      { name: "target", type: "address", indexed: false },
      { name: "value", type: "uint256", indexed: false },
      { name: "success", type: "bool", indexed: false },
      { name: "returnData", type: "bytes", indexed: false },
    ],
  },
] as const

export function getExecutorAddress(chainId: number): `0x${string}` {
  const address = EXECUTOR_ADDRESSES[chainId]
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Executor not deployed on chain ${chainId}`)
  }
  return address
}

export function toBytes32(agentId: string): `0x${string}` {
  if (agentId.startsWith("0x") && agentId.length === 66) {
    return agentId as `0x${string}`
  }

  const uuid = agentId.replace(/-/g, "")
  if (uuid.length === 32) {
    return `0x${uuid.padStart(64, "0")}` as `0x${string}`
  }

  throw new Error(`Invalid agentId format: ${agentId}`)
}
