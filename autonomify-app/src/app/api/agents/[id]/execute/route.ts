import { NextRequest, NextResponse } from "next/server"
import { getAgent, simulate, execute } from "@/lib/agents/telegram"
import type { ApiResponse } from "@/lib/autonomify-core"

interface ExecuteBody {
  contractAddress: string
  functionName: string
  args: unknown[]
  value?: string
  simulate?: boolean
}

interface ExecuteResponse {
  success: boolean
  txHash?: string
  explorerUrl?: string
  gasEstimate?: string
  returnData?: unknown
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await getAgent(params.id)

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

  const args = body.args || []

  if (body.simulate) {
    const result = await simulate(agent, contract, {
      contractAddress: body.contractAddress,
      functionName: body.functionName,
      args,
      value: body.value,
    })

    return NextResponse.json<ApiResponse<ExecuteResponse>>({
      ok: result.success,
      data: {
        success: result.success,
        gasEstimate: result.gasEstimate,
        returnData: result.returnData,
        error: result.error,
      },
      error: result.error,
    })
  }

  const result = await execute(agent, contract, {
    contractAddress: body.contractAddress,
    functionName: body.functionName,
    args,
    value: body.value,
  })

  return NextResponse.json<ApiResponse<ExecuteResponse>>({
    ok: result.success,
    data: {
      success: result.success,
      txHash: result.txHash,
      explorerUrl: result.explorerUrl,
      error: result.error,
    },
    error: result.error,
  })
}
