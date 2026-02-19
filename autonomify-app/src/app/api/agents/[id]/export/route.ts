/**
 * Agent Export API
 *
 * Returns the AutonomifyExport JSON for a specific agent.
 * Used by self-hosted agents to download their configuration.
 */

import { NextRequest, NextResponse } from "next/server"
import { getAgent } from "@/lib/agents/telegram"
import { generateExport, getChainById, type ApiResponse, type AutonomifyExport } from "@/lib/autonomify-core"

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

  if (agent.contracts.length === 0) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent has no contracts" },
      { status: 400 }
    )
  }

  // Get chain from first contract (assuming all contracts are on same chain)
  const chainId = agent.contracts[0].chain.id
  const chain = getChainById(chainId)

  if (!chain) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Unknown chain" },
      { status: 400 }
    )
  }

  const exportData = generateExport(chain, agent.contracts)

  // Add agent-specific info for self-hosted usage
  const response: AutonomifyExport & { agentId: string; agentName: string } = {
    ...exportData,
    agentId: agent.agentIdBytes || agent.id,
    agentName: agent.name,
  }

  return NextResponse.json<ApiResponse<typeof response>>({
    ok: true,
    data: response,
  })
}
