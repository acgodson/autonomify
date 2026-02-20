import { encodeFunctionData, parseEther, type Abi } from "viem"
import type { AutonomifyExport, ExecuteParams, UnsignedTransaction } from "../types"
import { EXECUTOR_ABI, toBytes32 } from "./executor"
import { parseStringifiedArray } from "./utils"

function convertArgs(abi: Abi, functionName: string, args: unknown[]): unknown[] {
  const fn = abi.find(
    (item) => item.type === "function" && "name" in item && item.name === functionName
  )
  if (!fn || fn.type !== "function" || !("inputs" in fn)) return args

  return args.map((arg, i) => {
    const input = fn.inputs[i]
    if (!input) return arg

    let processedArg = parseStringifiedArray(arg)

    if (input.type.endsWith("[]")) {
      if (Array.isArray(processedArg)) {
        processedArg = processedArg.map(parseStringifiedArray)
      }
    }

    if (input.type.startsWith("uint") || input.type.startsWith("int")) {
      if (typeof processedArg === "string" && /^\d+$/.test(processedArg)) {
        return BigInt(processedArg)
      }
      if (typeof processedArg === "number") {
        return BigInt(processedArg)
      }
    }

    return processedArg
  })
}

export function encodeContractCall(
  abi: Abi,
  functionName: string,
  args: unknown[]
): `0x${string}` {
  const convertedArgs = convertArgs(abi, functionName, args)
  return encodeFunctionData({ abi, functionName, args: convertedArgs })
}

export function encodeExecutorCall(
  agentId: string,
  targetContract: `0x${string}`,
  calldata: `0x${string}`
): `0x${string}` {
  const agentIdBytes32 = toBytes32(agentId)
  return encodeFunctionData({
    abi: EXECUTOR_ABI,
    functionName: "execute",
    args: [agentIdBytes32, targetContract, calldata],
  })
}

export function buildTransaction(
  config: AutonomifyExport,
  agentId: string,
  params: ExecuteParams
): UnsignedTransaction {
  const contract = config.contracts[params.contractAddress]
  if (!contract) {
    throw new Error(`Contract ${params.contractAddress} not found`)
  }

  const targetCalldata = encodeContractCall(
    contract.abi,
    params.functionName,
    params.args
  )

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
