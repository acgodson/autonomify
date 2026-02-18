import { NextRequest, NextResponse } from "next/server"
import { createAgent, listAgents } from "@/lib/agent-store"
import type { ApiResponse, AgentConfig } from "@/lib/types"

interface CreateAgentBody {
  name: string
  telegramBotToken: string
}

interface AgentPublic {
  id: string
  name: string
  walletAddress: string
  contractCount: number
  createdAt: number
}

function toPublic(agent: AgentConfig): AgentPublic {
  return {
    id: agent.id,
    name: agent.name,
    walletAddress: agent.wallet.address,
    contractCount: agent.contracts.length,
    createdAt: agent.createdAt,
  }
}

export async function GET() {
  const agents = listAgents()

  return NextResponse.json<ApiResponse<AgentPublic[]>>({
    ok: true,
    data: agents.map(toPublic),
  })
}

export async function POST(request: NextRequest) {
  let body: CreateAgentBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing or invalid name" },
      { status: 400 }
    )
  }

  if (!body.telegramBotToken || typeof body.telegramBotToken !== "string") {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing or invalid telegramBotToken" },
      { status: 400 }
    )
  }

  const agent = createAgent(body.name, body.telegramBotToken)

  return NextResponse.json<ApiResponse<AgentPublic & { walletPrivateKey: string }>>({
    ok: true,
    data: {
      ...toPublic(agent),
      walletPrivateKey: agent.wallet.privateKey,
    },
  })
}
