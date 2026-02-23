/**
 * Quick script to fix the router contract name in the database
 */
import "dotenv/config"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { eq } from "drizzle-orm"
import * as schema from "../src/lib/db/schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql, { schema })

async function main() {
  const routerAddress = "0xd99d1c33f9fc3444f8101754abc46c52416550d1"

  // Find the contract
  const contract = await db.query.agentContracts.findFirst({
    where: eq(schema.agentContracts.address, routerAddress),
  })

  if (!contract) {
    console.log("Router contract not found")
    return
  }

  console.log("Current metadata:", contract.metadata)

  // Update with proper name
  const updatedMetadata = {
    ...(contract.metadata as Record<string, unknown>),
    name: "PancakeSwap Router",
  }

  await db
    .update(schema.agentContracts)
    .set({ metadata: updatedMetadata })
    .where(eq(schema.agentContracts.id, contract.id))

  console.log("Updated metadata:", updatedMetadata)
  console.log("Done!")
}

main().catch(console.error)
