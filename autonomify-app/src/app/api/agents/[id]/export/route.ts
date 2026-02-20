/**
 * Agent Export API
 *
 * Returns the AutonomifyExport JSON for a specific agent.
 * Used by self-hosted agents to download their configuration.
 */

import { NextRequest, NextResponse } from "next/server"
import type { AutonomifyExport } from "autonomify-sdk"
import {
  getAgent,
  buildAgentExport,
  type ApiResponse,
} from "@/lib/agent"

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

  const exportData = buildAgentExport(agent)

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
