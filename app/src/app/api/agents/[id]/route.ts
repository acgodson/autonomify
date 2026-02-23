import { NextRequest, NextResponse } from "next/server"
import {
  getAgent,
  deleteAgent,
  type Agent,
  type ChannelType,
  type ApiResponse,
} from "@/lib/agent"

interface AgentDetail {
  id: string
  name: string
  type: ChannelType
  walletAddress?: string
  agentIdBytes?: string
  contracts: {
    address: string
    chain: string
    chainId: number
    metadata: Record<string, unknown>
    functionCount: number
  }[]
  createdAt: number
}

function toDetail(agent: Agent): AgentDetail {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.channel,
    walletAddress: agent.wallet?.address,
    agentIdBytes: agent.agentIdBytes,
    contracts: agent.contracts.map((c) => ({
      address: c.address,
      chain: c.chain.name,
      chainId: c.chainId,
      metadata: c.metadata,
      functionCount: c.functions.length,
    })),
    createdAt: agent.createdAt,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await getAgent(params.id)

  if (!agent) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  return NextResponse.json<ApiResponse<AgentDetail>>({
    ok: true,
    data: toDetail(agent),
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const deleted = await deleteAgent(params.id)

  if (!deleted) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  return NextResponse.json<ApiResponse>({ ok: true })
}
