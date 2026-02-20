/**
 * Telegram Webhook Handler
 *
 * Handles incoming Telegram messages via the channel wrapper.
 * All business logic is in @/lib/agent and @/lib/channels/telegram.
 */

import { NextRequest, NextResponse } from "next/server"
import { webhookCallback } from "grammy"
import { getAgent } from "@/lib/agent"
import { getTelegramBot } from "@/lib/channels"

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const agent = await getAgent(params.agentId)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  if (!agent.channelToken || !agent.wallet) {
    return NextResponse.json(
      { error: "Agent not configured for Telegram" },
      { status: 400 }
    )
  }

  const bot = getTelegramBot(agent)
  const handler = webhookCallback(bot, "std/http")

  return handler(request)
}
