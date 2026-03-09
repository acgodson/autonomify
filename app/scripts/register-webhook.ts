import "dotenv/config"
import { db } from "../src/lib/db"
import { agents } from "../src/lib/db/schema"
import { registerTelegramWebhook, getWebhookInfo } from "../src/lib/channels"

async function registerWebhooks() {
  const allAgents = await db.select().from(agents)

  console.log(`Found ${allAgents.length} agents\n`)

  for (const agent of allAgents) {
    console.log(`Agent: ${agent.name} (${agent.id})`)
    console.log(`  Type: ${agent.type}`)

    if (agent.type === "telegram" && agent.telegramBotToken) {
      // Check current webhook
      const info = await getWebhookInfo(agent.telegramBotToken)
      console.log(`  Current webhook: ${info.url || "(none)"}`)

      if (info.last_error_message) {
        console.log(`  Last error: ${info.last_error_message}`)
      }

      // Register webhook
      const result = await registerTelegramWebhook(agent.id, agent.telegramBotToken)

      if (result.success) {
        console.log(`  ✅ Webhook registered successfully`)

        // Verify
        const newInfo = await getWebhookInfo(agent.telegramBotToken)
        console.log(`  New webhook: ${newInfo.url}`)
      } else {
        console.log(`  ❌ Failed: ${result.error}`)
      }
    } else {
      console.log(`  Skipping (not telegram or no token)`)
    }

    console.log()
  }

  process.exit(0)
}

registerWebhooks().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
