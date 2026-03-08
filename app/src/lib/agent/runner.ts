import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
  formatEther,
  type Abi,
} from "viem"
import {
  validateCall,
  buildPrompt,
  forVercelAI,
  getExplorerUrl,
  getExecutorAddress,
  EXECUTOR_ABI,
  getChainOrThrow,
  type AutonomifyExport,
  type StructuredCall,
} from "autonomify-sdk"
import { DEFAULT_CHAIN_ID } from "@/lib/chains"
import type { Agent, AgentContract, ExecuteParams, SimulateResult, ExecuteResult } from "./types"
import { executeViaCRE, simulateViaCRE, getDelegation } from "./cre"
import { findContract, findAbiFunction } from "./utils"

export function buildAgentExport(agent: Agent): AutonomifyExport {
  const primaryContract = agent.contracts[0]
  const chainId = primaryContract?.chainId || DEFAULT_CHAIN_ID

  const chain = primaryContract?.chain || getChainOrThrow(chainId)

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

  const executorAddress = getExecutorAddress(chainId)

  return {
    version: "1.0.0",
    executor: {
      address: executorAddress,
      abi: EXECUTOR_ABI,
    },
    chain: {
      id: chainId,
      name: chain.name,
      rpc: chain.rpc[0],
    },
    contracts,
  }
}

export function buildAgentPrompt(agent: Agent): string {
  const exportData = buildAgentExport(agent)
  const sdkPrompt = buildPrompt(exportData)

  const agentContext = `## YOUR IDENTITY
- Agent: ${agent.name}
- Owner: ${agent.ownerAddress}
- Channel: ${agent.channel}

`
  return agentContext + sdkPrompt
}

export function createAgentTool(agent: Agent, userAddress: string, permissionsContext: string) {
  const exportData = buildAgentExport(agent)
  const primaryContract = agent.contracts[0]
  const chainId = primaryContract?.chainId || DEFAULT_CHAIN_ID

  const { tool } = forVercelAI({
    export: exportData,
    agentId: agent.id,
    signAndSend: async (tx) => {
      const contract = agent.contracts.find(
        (c) => c.address.toLowerCase() === tx.to.toLowerCase()
      )

      if (!contract) {
        throw new Error(`Contract ${tx.to} not found in agent`)
      }

      const result = await executeViaCRE({
        userAddress,
        agentId: agent.agentIdBytes!,
        chainId,
        targetContract: tx.to,
        functionAbi: contract.abi,
        functionName: "execute",
        args: [],
        value: tx.value?.toString() || "0",
        permissionsContext,
        simulateOnly: false,
      })

      if (!result.success || result.mode !== "execution") {
        throw new Error(result.error?.toString() || "Execution failed")
      }

      return result.txHash || ""
    },
  })

  return { tool }
}

export function validateAgentCall(agent: Agent, call: StructuredCall) {
  const exportData = buildAgentExport(agent)
  return validateCall(call, exportData)
}

function getClient(contract: AgentContract) {
  return createPublicClient({
    transport: http(contract.chain.rpc[0]),
  })
}

export async function simulate(
  agent: Agent,
  userAddress: string,
  params: ExecuteParams
): Promise<SimulateResult> {
  const contract = findContract(agent, params.contractAddress)
  if (!contract) {
    return { success: false, error: `Contract ${params.contractAddress} not found` }
  }

  const fn = findAbiFunction(contract.abi, params.functionName)
  if (!fn) {
    return { success: false, error: `Function ${params.functionName} not found` }
  }

  const delegation = await getDelegation(userAddress, contract.chainId)
  if (!delegation) {
    return { success: false, error: "No delegation found. Please set up your account first." }
  }

  try {
    const argsArray = Object.values(params.args)

    const result = await simulateViaCRE({
      userAddress,
      agentId: agent.agentIdBytes!,
      chainId: contract.chainId,
      targetContract: params.contractAddress,
      functionAbi: [fn] as Abi,
      functionName: params.functionName,
      args: argsArray,
      value: params.value || "0",
      permissionsContext: delegation.signedDelegation,
    })

    return {
      success: result.success,
      gasEstimate: result.gasEstimate,
      returnData: result.returnData,
      nullifier: result.nullifier,
      policySatisfied: result.policySatisfied === "0x0000000000000000000000000000000000000000000000000000000000000001",
      error: result.error?.recommendation || result.error?.decoded,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Simulation failed"
    return { success: false, error: message }
  }
}

export async function execute(
  agent: Agent,
  userAddress: string,
  params: ExecuteParams
): Promise<ExecuteResult> {
  const contract = findContract(agent, params.contractAddress)
  if (!contract) {
    return { success: false, error: `Contract ${params.contractAddress} not found` }
  }

  const fn = findAbiFunction(contract.abi, params.functionName)
  if (!fn) {
    return { success: false, error: `Function ${params.functionName} not found` }
  }

  const delegation = await getDelegation(userAddress, contract.chainId)
  if (!delegation) {
    return { success: false, error: "No delegation found. Please set up your account first." }
  }

  try {
    const argsArray = Object.values(params.args)

    const result = await executeViaCRE({
      userAddress,
      agentId: agent.agentIdBytes!,
      chainId: contract.chainId,
      targetContract: params.contractAddress,
      functionAbi: [fn] as Abi,
      functionName: params.functionName,
      args: argsArray,
      value: params.value || "0",
      permissionsContext: delegation.signedDelegation,
      simulateOnly: false,
    })

    if (result.mode !== "execution") {
      return { success: false, error: "Unexpected simulation result" }
    }

    const explorerUrl = result.txHash ? getExplorerUrl(contract.chainId, result.txHash) : null

    return {
      success: result.success,
      txHash: result.txHash,
      explorerUrl: explorerUrl || undefined,
      nullifier: result.nullifier,
      gasUsed: result.gasAnalysis?.total,
      error: result.error?.recommendation || result.error?.errorName,
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
