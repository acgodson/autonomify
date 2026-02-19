/**
 * Autonomify Encoder
 *
 * Encodes contract calls into calldata for AutonomifyExecutor.
 * Pure encoding logic - no wallet dependencies.
 */

import { encodeFunctionData, parseEther, type Abi } from "viem"
import type {
  AutonomifyExport,
  ExecuteParams,
  UnsignedTransaction,
} from "./types"

// AutonomifyExecutor.execute(bytes32 agentId, address target, bytes calldata data)
const EXECUTOR_EXECUTE_ABI = [
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

/**
 * Encode a contract function call into calldata
 */
export function encodeContractCall(
  abi: Abi,
  functionName: string,
  args: unknown[]
): `0x${string}` {
  return encodeFunctionData({
    abi,
    functionName,
    args,
  })
}

/**
 * Encode a full AutonomifyExecutor.execute() call
 */
export function encodeExecutorCall(
  agentId: `0x${string}`,
  targetContract: `0x${string}`,
  calldata: `0x${string}`
): `0x${string}` {
  return encodeFunctionData({
    abi: EXECUTOR_EXECUTE_ABI,
    functionName: "execute",
    args: [agentId, targetContract, calldata],
  })
}

/**
 * Build an unsigned transaction from ExecuteParams
 * This is what gets passed to the user's signAndSend function
 */
export function buildTransaction(
  config: AutonomifyExport,
  agentId: `0x${string}`,
  params: ExecuteParams
): UnsignedTransaction {
  const contract = config.contracts[params.contractAddress]
  if (!contract) {
    throw new Error(`Contract ${params.contractAddress} not found in export`)
  }

  // Encode the target contract call
  const targetCalldata = encodeContractCall(
    contract.abi,
    params.functionName,
    params.args
  )

  // Encode the executor call wrapping the target call
  const executorCalldata = encodeExecutorCall(
    agentId,
    params.contractAddress,
    targetCalldata
  )

  return {
    to: config.executor.address,
    data: executorCalldata,
    value: params.value ? parseEther(params.value) : BigInt(0),
    chainId: config.chain.id,
  }
}

/**
 * Build a simulation transaction (direct to target, not through executor)
 * Used for dry-run testing
 */
export function buildSimulationTransaction(
  config: AutonomifyExport,
  params: ExecuteParams
): UnsignedTransaction {
  const contract = config.contracts[params.contractAddress]
  if (!contract) {
    throw new Error(`Contract ${params.contractAddress} not found in export`)
  }

  const calldata = encodeContractCall(
    contract.abi,
    params.functionName,
    params.args
  )

  return {
    to: params.contractAddress,
    data: calldata,
    value: params.value ? parseEther(params.value) : BigInt(0),
    chainId: config.chain.id,
  }
}
