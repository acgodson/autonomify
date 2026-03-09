import "dotenv/config"
import { db } from "../src/lib/db"
import {
  conversationMessages,
  executions,
  agentContracts,
  agentAllowedContracts,
  agentPolicies,
  delegations,
  agents
} from "../src/lib/db/schema"
import { sql } from "drizzle-orm"

async function clearDatabase() {
  console.log("Clearing database...")

  // Delete in order to respect foreign key constraints
  await db.delete(conversationMessages)
  console.log("✓ Cleared conversation_messages")

  await db.delete(executions)
  console.log("✓ Cleared executions")

  await db.delete(agentContracts)
  console.log("✓ Cleared agent_contracts")

  await db.delete(agentAllowedContracts)
  console.log("✓ Cleared agent_allowed_contracts")

  await db.delete(agentPolicies)
  console.log("✓ Cleared agent_policies")

  await db.delete(delegations)
  console.log("✓ Cleared delegations")

  await db.delete(agents)
  console.log("✓ Cleared agents")

  console.log("\nDatabase cleared successfully!")
  process.exit(0)
}

clearDatabase().catch((err) => {
  console.error("Error clearing database:", err)
  process.exit(1)
})
