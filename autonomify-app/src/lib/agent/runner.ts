/**
 * Agent Runner
 *
 * Executes contract functions using the Autonomify SDK.
 * This file showing how to integrate the SDK with an LLM.
 *
 * The runner:
 * 1. Validates LLM-generated calls using SDK's validateCall
 * 2. Builds AutonomifyExport from agent contracts
 * 3. Uses SDK's forVercelAI() adapter for tool execution
 * 4. Routes transactions through the AutonomifyExecutor
 */

import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
  formatEther,
  type Abi,
  type AbiFunction,
} from "viem"
import {
  validateCall,
  buildPrompt,
  forVercelAI,
  getExplorerUrl,
  type AutonomifyExport,
  type StructuredCall,
} from "autonomify-sdk"
import type { Agent, AgentContract, ExecuteParams, SimulateResult, ExecuteResult } from "./types"
import { executeViaExecutor, executeDirectly } from "./wallet"

/**
 * Build an AutonomifyExport from agent contracts.
 * This is the format the SDK expects for validation and prompt generation.
 */
export function buildAgentExport(agent: Agent): AutonomifyExport {

  const primaryContract = agent.contracts[0]
  const chainId = primaryContract?.chainId || 97

  const contracts: AutonomifyExport["contracts"] = {}
  for (const contract of agent.contracts) {
    contracts[contract.address.toLowerCase() as `0x${string}`] = {
      name: (contract.metadata.name as string) || contract.address.slice(0, 10),
      abi: contract.abi,
      metadata: contract.metadata,
      functions: contract.functions.map((fn) => ({
        name: fn.name,
        signature: fn.signature,
        stateMutability: fn.stateMutability,
        inputs: fn.inputs,
        outputs: fn.outputs,
      })),
    }
  }

  return {
    version: "1.0.0",
    executor: {
      address: (process.env.AUTONOMIFY_EXECUTOR_ADDRESS ||
        "0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C") as `0x${string}`,
      abi: [],
    },
    chain: {
      id: chainId,
      name: primaryContract?.chain.name || "BNB Smart Chain Testnet",
      rpc: primaryContract?.chain.rpc[0] || "https://data-seed-prebsc-1-s1.binance.org:8545",
    },
    contracts,
  }
}


export function buildAgentPrompt(agent: Agent): string {
  if (!agent.wallet) throw new Error("Agent wallet required")

  const exportData = buildAgentExport(agent)
  const sdkPrompt = buildPrompt(exportData)

  const agentContext = `## YOUR IDENTITY
- Agent: ${agent.name}
- Wallet: ${agent.wallet.address}
- Channel: ${agent.channel}

`
  return agentContext + sdkPrompt
}


export function createAgentTool(agent: Agent) {
  if (!agent.wallet) throw new Error("Agent wallet required")

  const exportData = buildAgentExport(agent)
  const primaryContract = agent.contracts[0]
  const chainId = primaryContract?.chainId || 97

  const { tool } = forVercelAI({
    export: exportData,
    agentId: agent.id,
    signAndSend: async (tx) => {
      const result = await executeDirectly({
        walletId: agent.wallet!.privyWalletId,
        chainId,
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })

      return result.hash
    },
  })

  return { tool }
}


export function validateAgentCall(agent: Agent, call: StructuredCall) {
  const exportData = buildAgentExport(agent)
  return validateCall(call, exportData)
}


function findContract(agent: Agent, address: string): AgentContract | undefined {
  return agent.contracts.find(
    (c) => c.address.toLowerCase() === address.toLowerCase()
  )
}


function getClient(contract: AgentContract) {
  return createPublicClient({
    transport: http(contract.chain.rpc[0]),
  })
}

export async function simulate(
  agent: Agent,
  params: ExecuteParams
): Promise<SimulateResult> {
  const contract = findContract(agent, params.contractAddress)
  if (!contract) {
    return { success: false, error: `Contract ${params.contractAddress} not found` }
  }

  const fn = contract.abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && item.name === params.functionName
  )

  if (!fn) {
    return { success: false, error: `Function ${params.functionName} not found` }
  }

  try {
    const client = getClient(contract)
    const argsArray = Object.values(params.args)

    const callData = encodeFunctionData({
      abi: [fn],
      functionName: params.functionName,
      args: argsArray,
    })

    const value = params.value ? parseEther(params.value) : BigInt(0)

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

/**
 * Execute a contract call via the AutonomifyExecutor.
 */
export async function execute(
  agent: Agent,
  params: ExecuteParams
): Promise<ExecuteResult> {
  const contract = findContract(agent, params.contractAddress)
  if (!contract) {
    return { success: false, error: `Contract ${params.contractAddress} not found` }
  }

  const fn = contract.abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && item.name === params.functionName
  )

  if (!fn) {
    return { success: false, error: `Function ${params.functionName} not found` }
  }

  try {
    if (!agent.wallet) throw new Error("Agent wallet required for execution")

    const value = params.value ? parseEther(params.value) : undefined
    const argsArray = Object.values(params.args)

    const result = await executeViaExecutor({
      walletId: agent.wallet.privyWalletId,
      agentId: agent.id,
      chainId: contract.chainId,
      targetContract: params.contractAddress,
      functionAbi: [fn] as Abi,
      functionName: params.functionName,
      args: argsArray,
      value,
    })

    const explorerUrl = getExplorerUrl(contract.chainId, result.hash)

    return {
      success: result.success,
      txHash: result.hash,
      explorerUrl: explorerUrl || undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed"
    return { success: false, error: message }
  }
}


export async function getNativeBalance(
  chainId: number,
  rpcUrl: string,
  address: string
): Promise<{ balance: string; formatted: string }> {
  const client = createPublicClient({
    transport: http(rpcUrl),
  })

  const balance = await client.getBalance({
    address: address as `0x${string}`,
  })

  return {
    balance: balance.toString(),
    formatted: formatEther(balance),
  }
}
