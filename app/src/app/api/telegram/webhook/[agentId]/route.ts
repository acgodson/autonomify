import { NextRequest, NextResponse } from "next/server"
import { webhookCallback } from "grammy"
import { getAgent, type ApiResponse } from "@/lib/agent"
import { getTelegramBot } from "@/lib/channels"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params
    const agent = await getAgent(agentId)

    if (!agent) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: "Agent not found" },
        { status: 404 }
      )
    }

    if (!agent.channelToken) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: "Agent not configured for Telegram" },
        { status: 400 }
      )
    }

    const bot = getTelegramBot(agent)
    // Increase timeout to 60 seconds to accommodate LLM + CRE processing time
    const handler = webhookCallback(bot, "std/http", {
      timeoutMilliseconds: 60_000,
    })

    return handler(request)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler error"
    console.error("Telegram webhook error:", message)
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
