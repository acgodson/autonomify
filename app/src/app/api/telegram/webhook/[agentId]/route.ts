/**
 * Telegram Webhook Handler
 *
 * Handles incoming Telegram messages via the channel wrapper.
 * All business logic is in @/lib/agent and @/lib/channels/telegram.
 */

import { NextRequest, NextResponse } from "next/server"
import { webhookCallback } from "grammy"
import { getAgent, type ApiResponse } from "@/lib/agent"
import { getTelegramBot } from "@/lib/channels"

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  try {
    const agent = await getAgent(params.agentId)

    if (!agent) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: "Agent not found" },
        { status: 404 }
      )
    }

    if (!agent.channelToken || !agent.wallet) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: "Agent not configured for Telegram" },
        { status: 400 }
      )
    }

    const bot = getTelegramBot(agent)
    const handler = webhookCallback(bot, "std/http")

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
