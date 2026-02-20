import { NextRequest, NextResponse } from "next/server"
import { createAgent, listAgents, type AgentConfig, type AgentType } from "@/lib/agents/telegram"
import type { ApiResponse } from "@/lib/autonomify-core"

interface CreateAgentBody {
  name: string
  type?: AgentType
  ownerAddress: string
  telegramBotToken?: string
}

interface AgentPublic {
  id: string
  name: string
  type: AgentType
  walletAddress?: string
  agentIdBytes?: string
  contractCount: number
  createdAt: number
}

function toPublic(agent: AgentConfig): AgentPublic {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.type,
    walletAddress: agent.wallet?.address,
    agentIdBytes: agent.agentIdBytes,
    contractCount: agent.contracts.length,
    createdAt: agent.createdAt,
  }
}

export async function GET(request: NextRequest) {
  const ownerAddress = request.headers.get("x-owner-address")

  if (!ownerAddress) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing owner address" },
      { status: 401 }
    )
  }

  const agents = await listAgents(ownerAddress)

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

  if (!body.ownerAddress || typeof body.ownerAddress !== "string") {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing owner address" },
      { status: 401 }
    )
  }

  const agentType = body.type || "telegram"

  // Validate hosted agents need a bot token
  if (agentType === "telegram" && (!body.telegramBotToken || typeof body.telegramBotToken !== "string")) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Telegram agents require a bot token" },
      { status: 400 }
    )
  }

  try {
    const agent = await createAgent({
      name: body.name,
      type: agentType,
      ownerAddress: body.ownerAddress,
      telegramBotToken: body.telegramBotToken,
    })

    const response: AgentPublic & { privyWalletId?: string } = {
      ...toPublic(agent),
    }

    // Include privyWalletId for hosted agents
    if (agent.wallet) {
      response.privyWalletId = agent.wallet.privyWalletId
    }

    return NextResponse.json<ApiResponse<typeof response>>({
      ok: true,
      data: response,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create agent"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
