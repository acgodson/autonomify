import { NextRequest, NextResponse } from "next/server"
import { getAgent, deleteAgent, type AgentConfig, type AgentType } from "@/lib/agents/telegram"
import type { ApiResponse } from "@/lib/autonomify-core"

interface AgentDetail {
  id: string
  name: string
  type: AgentType
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

function toDetail(agent: AgentConfig): AgentDetail {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    walletAddress: agent.wallet?.address,
    agentIdBytes: agent.agentIdBytes,
    contracts: agent.contracts.map((c) => ({
      address: c.address,
      chain: c.chain.name,
      chainId: c.chain.id,
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
