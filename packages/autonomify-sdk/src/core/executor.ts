/**
 * Executor Contract Addresses
 *
 * To add a new chain:
 * 1. Deploy the AutonomifyExecutor contract to the chain
 * 2. Add the address here
 * 3. That's it!
 *
 * Zero address means "not yet deployed" - SDK will throw helpful error.
 */
export const EXECUTOR_ADDRESSES: Record<number, `0x${string}`> = {
  // ---------------------------------------------------------------------------
  // TESTNETS (deployed)
  // ---------------------------------------------------------------------------
  97: "0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C",        // BSC Testnet ✓

  // ---------------------------------------------------------------------------
  // TESTNETS (pending deployment)
  // ---------------------------------------------------------------------------
  11155111: "0x0000000000000000000000000000000000000000",  // Sepolia
  80002: "0x0000000000000000000000000000000000000000",     // Polygon Amoy
  421614: "0x0000000000000000000000000000000000000000",    // Arbitrum Sepolia
  84532: "0x0000000000000000000000000000000000000000",     // Base Sepolia

  // ---------------------------------------------------------------------------
  // MAINNETS (pending deployment)
  // ---------------------------------------------------------------------------
  1: "0x0000000000000000000000000000000000000000",         // Ethereum
  56: "0x0000000000000000000000000000000000000000",        // BSC
  137: "0x0000000000000000000000000000000000000000",       // Polygon
  42161: "0x0000000000000000000000000000000000000000",     // Arbitrum
  8453: "0x0000000000000000000000000000000000000000",      // Base
  10: "0x0000000000000000000000000000000000000000",        // Optimism
  43114: "0x0000000000000000000000000000000000000000",     // Avalanche
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

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"


export function getExecutorAddress(chainId: number): `0x${string}` {
  const address = EXECUTOR_ADDRESSES[chainId]
  if (!address || address === ZERO_ADDRESS) {
    throw new Error(
      `Executor not deployed on chain ${chainId}. ` +
      `Deploy the contract and add the address to EXECUTOR_ADDRESSES.`
    )
  }
  return address
}


export function isExecutorDeployed(chainId: number): boolean {
  const address = EXECUTOR_ADDRESSES[chainId]
  return !!address && address !== ZERO_ADDRESS
}


export function getDeployedChainIds(): number[] {
  return Object.entries(EXECUTOR_ADDRESSES)
    .filter(([_, addr]) => addr !== ZERO_ADDRESS)
    .map(([id]) => parseInt(id, 10))
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
