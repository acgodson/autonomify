export const EXECUTOR_ADDRESSES: Record<number, `0x${string}`> = {
  // Base Sepolia - CRE architecture with EIP-7702
  84532: "0xD44def7f75Fea04B402688FF14572129D2BEeb05",
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
