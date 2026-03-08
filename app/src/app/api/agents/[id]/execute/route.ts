import { NextRequest, NextResponse } from "next/server"
import {
  getAgent,
  simulate,
  execute,
  type ApiResponse,
} from "@/lib/agent"

interface ExecuteBody {
  userAddress: string
  contractAddress: string
  functionName: string
  args: Record<string, unknown> | unknown[]
  value?: string
  simulate?: boolean
}

interface ExecuteResponse {
  success: boolean
  txHash?: string
  explorerUrl?: string
  gasEstimate?: number
  returnData?: string
  nullifier?: string
  gasUsed?: number
  error?: string
}

function normalizeArgs(
  args: Record<string, unknown> | unknown[] | undefined
): Record<string, unknown> {
  if (!args) return {}
  if (Array.isArray(args)) {
    const result: Record<string, unknown> = {}
    args.forEach((arg, i) => {
      result[`arg${i}`] = arg
    })
    return result
  }
  return args
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const agent = await getAgent(id)

  if (!agent) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  let body: ExecuteBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!body.userAddress) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing userAddress" },
      { status: 400 }
    )
  }

  if (!body.contractAddress || !body.functionName) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing contractAddress or functionName" },
      { status: 400 }
    )
  }

  const contract = agent.contracts.find(
    (c) => c.address.toLowerCase() === body.contractAddress.toLowerCase()
  )

  if (!contract) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Contract not found on this agent" },
      { status: 404 }
    )
  }

  const executeParams = {
    contractAddress: body.contractAddress,
    functionName: body.functionName,
    args: normalizeArgs(body.args),
    value: body.value,
  }

  if (body.simulate) {
    const result = await simulate(agent, body.userAddress, executeParams)

    return NextResponse.json<ApiResponse<ExecuteResponse>>({
      ok: result.success,
      data: {
        success: result.success,
        gasEstimate: result.gasEstimate,
        returnData: result.returnData,
        nullifier: result.nullifier,
        error: result.error,
      },
      error: result.error,
    })
  }

  const result = await execute(agent, body.userAddress, executeParams)

  return NextResponse.json<ApiResponse<ExecuteResponse>>({
    ok: result.success,
    data: {
      success: result.success,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      nullifier: result.nullifier,
      gasUsed: result.gasUsed,
      error: result.error,
    },
    error: result.error,
  })
}
