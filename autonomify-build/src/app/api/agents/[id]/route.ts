import { NextRequest, NextResponse } from "next/server"
import { getAgent, deleteAgent } from "@/lib/agent-store"
import type { ApiResponse, AgentConfig } from "@/lib/types"

interface AgentDetail {
  id: string
  name: string
  walletAddress: string
  contracts: {
    address: string
    chain: string
    metadata: Record<string, unknown>
    functionCount: number
  }[]
  createdAt: number
}

function toDetail(agent: AgentConfig): AgentDetail {
  return {
    id: agent.id,
    name: agent.name,
    walletAddress: agent.wallet.address,
    contracts: agent.contracts.map((c) => ({
      address: c.address,
      chain: c.chain.name,
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
  const agent = getAgent(params.id)

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
  const deleted = deleteAgent(params.id)

  if (!deleted) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  return NextResponse.json<ApiResponse>({ ok: true })
}
