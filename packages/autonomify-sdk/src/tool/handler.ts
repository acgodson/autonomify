import { createPublicClient, http, decodeFunctionResult, getAddress, formatUnits, type Abi } from "viem"
import type { ToolConfig, ExecuteResult, StructuredCall } from "../types"
import { encodeContractCall, buildTransaction } from "../core/encoder"
import { findFunction, isReadOnly, serializeBigInts, argsToArray } from "../core/utils"

export async function executeCall(
  config: ToolConfig,
  call: StructuredCall
): Promise<ExecuteResult> {
  const exportData = config.export
  const { agentId, submitTx, rpcUrl } = config

  try {
    const contractAddress = getAddress(call.contractAddress) as `0x${string}`

    // Debug logging
    console.log(`[SDK] executeCall: ${call.functionName} on ${contractAddress}`)
    console.log(`[SDK] Available contracts: ${Object.keys(exportData.contracts).join(", ")}`)

    const found = findFunction(exportData, contractAddress, call.functionName)

    if (!found) {
      console.log(`[SDK] Function ${call.functionName} NOT FOUND on ${contractAddress}`)
      return {
        success: false,
        error: `Function ${call.functionName} not found on ${contractAddress}`,
      }
    }

    console.log(`[SDK] Found function: ${found.fn.name} on ${found.contract}`)
    console.log(`[SDK] Args: ${JSON.stringify(call.args)}`)
    console.log(`[SDK] StateMutability: ${found.fn.stateMutability}`)

    const argsArray = argsToArray(
      exportData,
      contractAddress,
      call.functionName,
      call.args
    )

    console.log(`[SDK] ArgsArray: ${JSON.stringify(argsArray)}`)

    // Quoter functions are technically nonpayable but should be called as read-only
    const isQuoterFunction = call.functionName.startsWith("quote")
    if (isReadOnly(found.fn) || isQuoterFunction) {
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

        // Format balanceOf results with symbol and decimals
        if (call.functionName === "balanceOf" && typeof decoded === "bigint") {
          const contract = exportData.contracts[contractAddress.toLowerCase() as `0x${string}`]
          const decimals = (contract?.metadata?.decimals as number) || 18
          const symbol = (contract?.metadata?.symbol as string) || "tokens"
          const formatted = formatUnits(decoded, decimals)
          return {
            success: true,
            readResult: `${formatted} ${symbol}`,
            raw: decoded.toString(),
          }
        }

        return {
          success: true,
          readResult: serializeBigInts(decoded),
        }
      }

      return { success: true, readResult: null }
    }

    console.log(`[SDK] Building transaction for write function...`)

    const tx = buildTransaction(exportData, agentId, {
      contractAddress,
      functionName: call.functionName,
      args: argsArray,
      value: call.value,
    })

    console.log(`[SDK] TX built: to=${tx.to}, data=${tx.data.slice(0, 20)}...`)
    console.log(`[SDK] Calling submitTx...`)

    const txHash = await submitTx(tx)

    console.log(`[SDK] TX submitted: ${txHash}`)

    return { success: true, txHash }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
