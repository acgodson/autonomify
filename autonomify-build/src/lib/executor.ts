import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  type Abi,
  type AbiFunction,
  formatEther,
  parseEther,
} from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { ChainConfig, AgentConfig, ContractContext } from "./types"

interface ExecuteParams {
  contractAddress: string
  functionName: string
  args: unknown[]
  value?: string
}

interface SimulateResult {
  success: boolean
  gasEstimate?: string
  error?: string
  returnData?: unknown
}

interface ExecuteResult {
  success: boolean
  txHash?: string
  explorerUrl?: string
  error?: string
}

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

  const account = privateKeyToAccount(agent.wallet.privateKey as `0x${string}`)

  try {
    const callData = encodeFunctionData({
      abi: [fn],
      functionName: params.functionName,
      args: params.args,
    })

    const value = params.value ? parseEther(params.value) : BigInt(0)

    if (fn.stateMutability === "view" || fn.stateMutability === "pure") {
      const result = await client.call({
        account: account.address,
        to: params.contractAddress as `0x${string}`,
        data: callData,
      })
      return {
        success: true,
        returnData: result.data,
      }
    }

    const gasEstimate = await client.estimateGas({
      account: account.address,
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
  const viemChain = getViemChain(contract.chain)

  const account = privateKeyToAccount(agent.wallet.privateKey as `0x${string}`)

  const walletClient = createWalletClient({
    account,
    chain: viemChain,
    transport: http(contract.chain.rpc),
  })

  const publicClient = createPublicClient({
    chain: viemChain,
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
    const value = params.value ? parseEther(params.value) : BigInt(0)

    const { request } = await publicClient.simulateContract({
      account,
      address: params.contractAddress as `0x${string}`,
      abi: [fn] as Abi,
      functionName: params.functionName,
      args: params.args,
      value,
    })

    const txHash = await walletClient.writeContract(request)

    return {
      success: true,
      txHash,
      explorerUrl: `${contract.chain.explorer}/tx/${txHash}`,
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
