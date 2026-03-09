import {
  createPublicClient,
  http,
  encodeFunctionData,
  formatEther,
  type Abi,
  type AbiFunction,
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
import { triggerCRE, getDelegation, type CRESimulationResult } from "./cre"
import { findContract, findAbiFunction } from "./utils"

export function buildAgentExport(agent: Agent): AutonomifyExport {
  const primaryContract = agent.contracts[0]
  const chainId = primaryContract?.chainId || DEFAULT_CHAIN_ID

  const chain = primaryContract?.chain || getChainOrThrow(chainId)

  const contracts: AutonomifyExport["contracts"] = {}
  for (const contract of agent.contracts) {
    const functionDescriptions = contract.analysis?.functionDescriptions || {}
    // Name fallback chain: metadata.name -> analysis.name -> analysis.contractType -> address prefix
    const contractName =
      (contract.metadata.name as string) ||
      contract.analysis?.name ||
      contract.analysis?.contractType ||
      contract.address.slice(0, 10)
    contracts[contract.address.toLowerCase() as `0x${string}`] = {
      name: contractName,
      abi: contract.abi,
      metadata: {
        ...contract.metadata,
        ...(contract.analysis && {
          summary: contract.analysis.summary,
          contractType: contract.analysis.contractType,
          capabilities: contract.analysis.capabilities,
        }),
      },
      functions: contract.functions.map((fn) => ({
        name: fn.name,
        signature: fn.signature,
        stateMutability: fn.stateMutability,
        inputs: fn.inputs,
        outputs: fn.outputs,
        description: functionDescriptions[fn.name],
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
- Owner Wallet: ${agent.ownerAddress}
- Channel: ${agent.channel}

## KEY BEHAVIOR
- When user asks about "my balance", "my wallet", "my address", or "the balance", they mean the Owner Wallet above
- Always use ${agent.ownerAddress} when checking balances for the user
- For view/read functions (balanceOf, allowance, etc.), call them directly with the owner wallet
- For write functions (transfer, approve, etc.), confirm with user first

`
  return agentContext + sdkPrompt
}

export function createAgentTool(agent: Agent, userAddress: string, permissionsContext: string) {
  const exportData = buildAgentExport(agent)

  const { tool } = forVercelAI({
    export: exportData,
    agentId: agent.agentIdBytes!,
    submitTx: async (tx) => {
      // tx.data is already encoded by the SDK - pass it directly to CRE
      const result = await triggerCRE({
        userAddress,
        agentId: agent.agentIdBytes!,
        target: tx.to,
        calldata: tx.data,
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

    const calldata = encodeFunctionData({
      abi: [fn] as Abi,
      functionName: params.functionName,
      args: argsArray,
    })

    const result = await triggerCRE({
      userAddress,
      agentId: agent.agentIdBytes!,
      target: params.contractAddress,
      calldata,
      value: params.value || "0",
      permissionsContext: delegation.signedDelegation,
      simulateOnly: true,
    }) as CRESimulationResult

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

    const calldata = encodeFunctionData({
      abi: [fn] as Abi,
      functionName: params.functionName,
      args: argsArray,
    })

    const result = await triggerCRE({
      userAddress,
      agentId: agent.agentIdBytes!,
      target: params.contractAddress,
      calldata,
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
