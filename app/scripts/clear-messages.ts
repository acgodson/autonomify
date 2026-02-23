/**
 * Clear all conversation messages from the database
 * Run: pnpm tsx scripts/clear-messages.ts
 */

import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { conversationMessages } from "../src/lib/db/schema"
import { config } from "dotenv"

config({ path: ".env" })

async function main() {
  const sql = neon(process.env.DATABASE_URL!)
  const db = drizzle(sql)

  console.log("Clearing all conversation messages...")

  const result = await db.delete(conversationMessages).returning({ id: conversationMessages.id })

  console.log(`Deleted ${result.length} messages`)
  console.log("Done! Conversation history cleared.")
}

main().catch(console.error)
