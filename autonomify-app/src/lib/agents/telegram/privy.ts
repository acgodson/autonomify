/**
 * Privy Server Wallet Integration
 *
 * Manages Privy server wallets for agent transaction signing.
 * All transactions are routed through the AutonomifyExecutor contract.
 */

import { PrivyClient } from "@privy-io/node"
import { encodeFunctionData, type Abi } from "viem"
import { bscTestnet } from "@/lib/autonomify-core"

const PRIVY_APP_ID = process.env.PRIVY_ID!
const PRIVY_APP_SECRET = process.env.PRIVY_SECRET!
const EXECUTOR_ADDRESS = process.env.AUTONOMIFY_EXECUTOR_ADDRESS!

const privy = new PrivyClient({
  appId: PRIVY_APP_ID,
  appSecret: PRIVY_APP_SECRET,
})

// AutonomifyExecutor ABI (only the execute function we need)
const EXECUTOR_ABI = [
  {
    name: "execute",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "agentId", type: "bytes32" },
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [
      { name: "success", type: "bool" },
      { name: "result", type: "bytes" },
    ],
  },
] as const

export interface PrivyWallet {
  id: string
  address: string
}

export async function createAgentWallet(): Promise<PrivyWallet> {
  const wallet = await privy.wallets().create({
    chain_type: "ethereum",
  })

  return {
    id: wallet.id,
    address: wallet.address,
  }
}

export async function getWallet(walletId: string): Promise<PrivyWallet | null> {
  try {
    const wallet = await privy.wallets().get(walletId)
    return {
      id: wallet.id,
      address: wallet.address,
    }
  } catch {
    return null
  }
}

export interface ExecuteViaExecutorParams {
  walletId: string
  agentId: string
  targetContract: string
  functionName: string
  functionAbi: Abi
  args: unknown[]
  value?: bigint
}

export async function executeViaExecutor(
  params: ExecuteViaExecutorParams
): Promise<{ hash: string; success: boolean }> {
  const { walletId, agentId, targetContract, functionName, functionAbi, args, value } = params

  // Encode the target function call
  const targetCalldata = encodeFunctionData({
    abi: functionAbi,
    functionName,
    args,
  })

  // Convert agentId string to bytes32
  const agentIdBytes32 = agentId.startsWith("0x")
    ? agentId
    : `0x${Buffer.from(agentId).toString("hex").padEnd(64, "0")}`

  // Encode the executor call
  const executorCalldata = encodeFunctionData({
    abi: EXECUTOR_ABI,
    functionName: "execute",
    args: [agentIdBytes32 as `0x${string}`, targetContract as `0x${string}`, targetCalldata],
  })

  // BSC Testnet CAIP-2 identifier
  const caip2 = `eip155:${bscTestnet.id}`

  const response = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2,
    params: {
      transaction: {
        to: EXECUTOR_ADDRESS,
        data: executorCalldata,
        value: value ? `0x${value.toString(16)}` : "0x0",
        chain_id: bscTestnet.id,
      },
    },
  })

  return {
    hash: response.hash,
    success: true,
  }
}

export async function executeDirectly(params: {
  walletId: string
  to: string
  data: string
  value?: bigint
}): Promise<{ hash: string }> {
  const { walletId, to, data, value } = params

  const caip2 = `eip155:${bscTestnet.id}`

  const response = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2,
    params: {
      transaction: {
        to,
        data,
        value: value ? `0x${value.toString(16)}` : "0x0",
        chain_id: bscTestnet.id,
      },
    },
  })

  return { hash: response.hash }
}

export { privy }
