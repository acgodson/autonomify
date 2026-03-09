/**
 * Test Telegram Webhook Flow
 *
 * This script tests the Telegram webhook API endpoint directly,
 * simulating incoming Telegram messages to validate the full flow
 * including the SDK tools and CRE integration.
 *
 * Usage:
 *   pnpm tsx scripts/test-telegram-webhook.ts [agentId] [message]
 */

import "dotenv/config"
import { db } from "../src/lib/db"
import { agents } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

interface TelegramUpdate {
  update_id: number
  message: {
    message_id: number
    from: {
      id: number
      is_bot: boolean
      first_name: string
      username?: string
    }
    chat: {
      id: number
      first_name: string
      username?: string
      type: string
    }
    date: number
    text: string
  }
}

function createMockUpdate(messageId: number, chatId: number, text: string): TelegramUpdate {
  return {
    update_id: Math.floor(Math.random() * 1000000000),
    message: {
      message_id: messageId,
      from: {
        id: chatId,
        is_bot: false,
        first_name: "TestUser",
        username: "test_user",
      },
      chat: {
        id: chatId,
        first_name: "TestUser",
        username: "test_user",
        type: "private",
      },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  }
}

async function sendWebhookMessage(
  agentId: string,
  message: string,
  chatId = 123456789,
  messageId = Math.floor(Math.random() * 100000)
): Promise<{ status: number; body: any }> {
  const update = createMockUpdate(messageId, chatId, message)
  const webhookUrl = `${APP_URL}/api/telegram/webhook/${agentId}`

  console.log(`\n→ Sending: "${message}"`)
  console.log(`  Webhook: ${webhookUrl}`)

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  })

  let body: any
  const contentType = response.headers.get("content-type")
  if (contentType?.includes("application/json")) {
    body = await response.json()
  } else {
    body = await response.text()
  }

  console.log(`  Status: ${response.status}`)

  return { status: response.status, body }
}

async function main() {
  const args = process.argv.slice(2)
  let agentId = args[0]
  let testMessage = args.slice(1).join(" ") || "What's my LINK balance?"

  // Find agent if not specified
  if (!agentId || !agentId.match(/^[0-9a-f-]{36}$/i)) {
    testMessage = args.join(" ") || "What's my LINK balance?"
    const result = await db.select().from(agents).limit(1)
    if (result.length === 0) {
      console.error("No agents found")
      process.exit(1)
    }
    agentId = result[0].id
  }

  // Get agent details
  const [agent] = await db.select().from(agents).where(eq(agents.id, agentId)).limit(1)
  if (!agent) {
    console.error(`Agent ${agentId} not found`)
    process.exit(1)
  }

  console.log("═".repeat(60))
  console.log("  TELEGRAM WEBHOOK TEST")
  console.log("═".repeat(60))
  console.log(`  Agent: ${agent.name}`)
  console.log(`  Owner: ${agent.ownerAddress.slice(0, 10)}...`)
  console.log(`  Telegram: ${agent.telegramBotToken ? "configured" : "NOT configured"}`)

  if (!agent.telegramBotToken) {
    console.error("\nAgent does not have a Telegram bot token configured")
    process.exit(1)
  }

  // Test single message
  console.log("\n─".repeat(60))
  const result = await sendWebhookMessage(agentId, testMessage)

  if (result.status === 200) {
    console.log("  ✓ Webhook processed successfully")
  } else {
    console.log("  ✗ Webhook failed")
    console.log("  Response:", JSON.stringify(result.body, null, 2))
  }

  console.log("\n" + "═".repeat(60))

  process.exit(result.status === 200 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
