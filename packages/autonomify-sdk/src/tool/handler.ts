import { createPublicClient, http, decodeFunctionResult, getAddress, type Abi } from "viem"
import type { ToolConfig, ExecuteResult, StructuredCall } from "../types"
import { encodeContractCall, buildTransaction } from "../core/encoder"
import { findFunction, isReadOnly, serializeBigInts, argsToArray } from "../core/utils"

export async function executeCall(
  config: ToolConfig,
  call: StructuredCall
): Promise<ExecuteResult> {
  const exportData = config.export
  const { agentId, signAndSend, rpcUrl } = config

  try {
    const contractAddress = getAddress(call.contractAddress) as `0x${string}`
    const found = findFunction(exportData, contractAddress, call.functionName)

    if (!found) {
      return {
        success: false,
        error: `Function ${call.functionName} not found on ${contractAddress}`,
      }
    }

    const argsArray = argsToArray(
      exportData,
      contractAddress,
      call.functionName,
      call.args
    )

    if (isReadOnly(found.fn)) {
      const client = createPublicClient({
        transport: http(rpcUrl || exportData.chain.rpc),
      })

      const data = encodeContractCall(
        found.abi as Abi,
        call.functionName,
        argsArray
      )

      const result = await client.call({
        to: contractAddress,
        data,
      } as { to: `0x${string}`; data: `0x${string}` })

      if (result.data) {
        const decoded = decodeFunctionResult({
          abi: found.abi as Abi,
          functionName: call.functionName,
          data: result.data,
        })

        return {
          success: true,
          readResult: serializeBigInts(decoded),
        }
      }

      return { success: true, readResult: null }
    }

    const tx = buildTransaction(exportData, agentId, {
      contractAddress,
      functionName: call.functionName,
      args: argsArray,
      value: call.value,
    })

    const txHash = await signAndSend(tx)

    return { success: true, txHash }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
