/**
 * Get agent info before deletion
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { agents, agentPolicies, agentContracts } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

async function main() {
  console.log("Fetching agents for user 0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720...\n")

  const userAgents = await db.select().from(agents).where(
    eq(agents.ownerAddress, "0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720")
  )

  for (const agent of userAgents) {
    console.log("=== Agent ===")
    console.log("Name:", agent.name)
    console.log("Type:", agent.type)
    console.log("ID:", agent.id)
    console.log("Agent ID Bytes:", agent.agentIdBytes)
    console.log("Telegram Bot Token:", agent.telegramBotToken ? agent.telegramBotToken.slice(0, 20) + "..." : "N/A")
    console.log("")

    // Get policy
    const policies = await db.select().from(agentPolicies).where(eq(agentPolicies.agentId, agent.id))
    if (policies.length > 0) {
      console.log("Policy:")
      console.log("  Max TX Amount:", policies[0].txLimit)
      console.log("  Daily Limit:", policies[0].dailyLimit)
      console.log("  Time Window:", policies[0].enableTimeWindow ? `${policies[0].startHour}:00 - ${policies[0].endHour}:00` : "Disabled")
      console.log("")
    }

    // Get contracts
    const contracts = await db.select().from(agentContracts).where(eq(agentContracts.agentId, agent.id))
    console.log("Contracts:", contracts.length)
    for (const c of contracts) {
      console.log(`  - ${c.address} (chain ${c.chainId})`)
    }
    console.log("\n---\n")
  }

  // Now delete
  console.log("Deleting all agents for this user...")
  for (const agent of userAgents) {
    await db.delete(agents).where(eq(agents.id, agent.id))
    console.log(`  Deleted: ${agent.name}`)
  }
  console.log("\nDone!")
}

main().catch(console.error)
