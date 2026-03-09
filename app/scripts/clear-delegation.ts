/**
 * Clear delegations from database
 *
 * Usage: pnpm tsx scripts/clear-delegation.ts
 */

import "dotenv/config"
import { drizzle } from "drizzle-orm/neon-http"
import { neon } from "@neondatabase/serverless"
import { delegations } from "../src/lib/db/schema"

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle(sql)

async function main() {
  console.log("Fetching all delegations...")

  const allDelegations = await db.select({
    id: delegations.id,
    userAddress: delegations.userAddress,
    createdAt: delegations.createdAt,
  }).from(delegations)

  console.log(`Found ${allDelegations.length} delegations:`)
  for (const d of allDelegations) {
    console.log(`  - ${d.userAddress} (created: ${d.createdAt})`)
  }

  if (allDelegations.length === 0) {
    console.log("\nNo delegations to delete.")
    return
  }

  console.log("\nDeleting all delegations...")
  await db.delete(delegations)

  console.log("Done! All delegations cleared.")
}

main().catch(console.error)
