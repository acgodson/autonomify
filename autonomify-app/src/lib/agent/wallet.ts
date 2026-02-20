/**
 * Agent Wallet Management
 *
 * Manages Privy server wallets for agent transaction signing.
 * All transactions are routed through the AutonomifyExecutor contract.
 */

import { PrivyClient } from "@privy-io/node"
import { encodeFunctionData, type Abi } from "viem"
import { getChain, EXECUTOR_ABI, getExecutorAddress, toBytes32 } from "autonomify-sdk"
import type { AgentWallet } from "./types"

const PRIVY_APP_ID = process.env.PRIVY_ID!
const PRIVY_APP_SECRET = process.env.PRIVY_SECRET!

const privy = new PrivyClient({
  appId: PRIVY_APP_ID,
  appSecret: PRIVY_APP_SECRET,
})

export async function createAgentWallet(): Promise<AgentWallet> {
  const wallet = await privy.wallets().create({
    chain_type: "ethereum",
  })

  return {
    address: wallet.address,
    privyWalletId: wallet.id,
  }
}

export async function getWallet(walletId: string): Promise<AgentWallet | null> {
  try {
    const wallet = await privy.wallets().get(walletId)
    return {
      address: wallet.address,
      privyWalletId: wallet.id,
    }
  } catch {
    return null
  }
}

export interface ExecuteViaExecutorParams {
  walletId: string
  agentId: string
  chainId: number
  targetContract: string
  functionAbi: Abi
  functionName: string
  args: unknown[]
  value?: bigint
}

export async function executeViaExecutor(
  params: ExecuteViaExecutorParams
): Promise<{ hash: string; success: boolean }> {
  const {
    walletId,
    agentId,
    chainId,
    targetContract,
    functionAbi,
    functionName,
    args,
    value,
  } = params

  const chain = getChain(chainId)
  if (!chain) {
    throw new Error(`Unknown chain ID: ${chainId}`)
  }

  const executorAddress = getExecutorAddress(chainId)
  if (!executorAddress) {
    throw new Error(`No executor deployed on chain ${chainId}`)
  }

  // Encode the target function call
  const targetCalldata = encodeFunctionData({
    abi: functionAbi,
    functionName,
    args,
  })

  // Convert agentId to bytes32
  const agentIdBytes32 = toBytes32(agentId)

  const executorCalldata = encodeFunctionData({
    abi: EXECUTOR_ABI,
    functionName: "execute",
    args: [agentIdBytes32 as `0x${string}`, targetContract as `0x${string}`, targetCalldata],
  })

  const caip2 = `eip155:${chainId}`

  const response = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2,
    params: {
      transaction: {
        to: executorAddress,
        data: executorCalldata,
        value: value ? `0x${value.toString(16)}` : "0x0",
        chain_id: chainId,
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
  chainId: number
  to: string
  data: string
  value?: bigint
}): Promise<{ hash: string }> {
  const { walletId, chainId, to, data, value } = params

  const caip2 = `eip155:${chainId}`

  const response = await privy.wallets().ethereum().sendTransaction(walletId, {
    caip2,
    params: {
      transaction: {
        to,
        data,
        value: value ? `0x${value.toString(16)}` : "0x0",
        chain_id: chainId,
      },
    },
  })

  return { hash: response.hash }
}

export { privy }
