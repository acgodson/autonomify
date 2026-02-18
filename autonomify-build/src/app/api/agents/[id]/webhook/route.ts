import { NextRequest, NextResponse } from "next/server"
import { getAgent } from "@/lib/agent-store"
import type { ApiResponse } from "@/lib/types"

interface WebhookResponse {
  webhookUrl: string
  set: boolean
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = getAgent(params.id)

  if (!agent) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const webhookUrl = `${baseUrl}/api/telegram/webhook/${agent.id}`

  try {
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${agent.telegramBotToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      }
    )

    const telegramData = await telegramRes.json()

    if (!telegramData.ok) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: telegramData.description || "Failed to set webhook" },
        { status: 400 }
      )
    }

    return NextResponse.json<ApiResponse<WebhookResponse>>({
      ok: true,
      data: {
        webhookUrl,
        set: true,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to set webhook"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
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

  try {
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${agent.telegramBotToken}/getWebhookInfo`
    )

    const telegramData = await telegramRes.json()

    return NextResponse.json<ApiResponse>({
      ok: true,
      data: telegramData.result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to get webhook info"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

  try {
    const telegramRes = await fetch(
      `https://api.telegram.org/bot${agent.telegramBotToken}/deleteWebhook`
    )

    const telegramData = await telegramRes.json()

    return NextResponse.json<ApiResponse>({
      ok: telegramData.ok,
      data: { deleted: telegramData.ok },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete webhook"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
