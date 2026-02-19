/**
 * Transaction Executor
 *
 * Executes contract functions via Privy server wallets.
 * Routes all transactions through the AutonomifyExecutor contract.
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Abi,
  type AbiFunction,
  formatEther,
  parseEther,
} from "viem"
import type { ChainConfig, ContractContext } from "@/lib/autonomify-core"
import type { AgentConfig, ExecuteParams, SimulateResult, ExecuteResult } from "./types"
import { executeViaExecutor } from "./privy"

function getViemChain(chain: ChainConfig) {
  return {
    id: chain.id,
    name: chain.name,
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: [chain.rpc] } },
    blockExplorers: { default: { name: "BscScan", url: chain.explorer } },
  }
}

export async function simulate(
  agent: AgentConfig,
  contract: ContractContext,
  params: ExecuteParams
): Promise<SimulateResult> {
  const client = createPublicClient({
    chain: getViemChain(contract.chain),
    transport: http(contract.chain.rpc),
  })

  const fn = contract.abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && item.name === params.functionName
  )

  if (!fn) {
    return { success: false, error: `Function ${params.functionName} not found` }
  }

  try {
    const callData = encodeFunctionData({
      abi: [fn],
      functionName: params.functionName,
      args: params.args,
    })

    const value = params.value ? parseEther(params.value) : BigInt(0)

    // For view/pure functions, we can call directly without wallet
    if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
      const result = await client.call({
        to: params.contractAddress as `0x${string}`,
        data: callData,
      })
      return {
        success: true,
        returnData: result.data,
      }
    }

    // For write functions, estimate gas using the agent's wallet address
    if (!agent.wallet) throw new Error("Agent wallet required for gas estimation")
    const gasEstimate = await client.estimateGas({
      account: agent.wallet.address as `0x${string}`,
      to: params.contractAddress as `0x${string}`,
      data: callData,
      value,
    })

    return {
      success: true,
      gasEstimate: gasEstimate.toString(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed"
    return { success: false, error: message }
  }
}

export async function execute(
  agent: AgentConfig,
  contract: ContractContext,
  params: ExecuteParams
): Promise<ExecuteResult> {
  const fn = contract.abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && item.name === params.functionName
  )

  if (!fn) {
    return { success: false, error: `Function ${params.functionName} not found` }
  }

  try {
    const value = params.value ? parseEther(params.value) : undefined

    // Execute via Privy wallet through the AutonomifyExecutor contract
    if (!agent.wallet) throw new Error("Agent wallet required for execution")
    const result = await executeViaExecutor({
      walletId: agent.wallet.privyWalletId,
      agentId: agent.id,
      targetContract: params.contractAddress,
      functionName: params.functionName,
      functionAbi: [fn] as Abi,
      args: params.args,
      value,
    })

    return {
      success: result.success,
      txHash: result.hash,
      explorerUrl: `${contract.chain.explorer}/tx/${result.hash}`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed"
    return { success: false, error: message }
  }
}

export async function getNativeBalance(
  chain: ChainConfig,
  address: string
): Promise<{ balance: string; formatted: string }> {
  const client = createPublicClient({
    transport: http(chain.rpc),
  })

  const balance = await client.getBalance({
    address: address as `0x${string}`,
  })

  return {
    balance: balance.toString(),
    formatted: formatEther(balance),
  }
}
