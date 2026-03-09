import { neon } from "@neondatabase/serverless"
import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.join(__dirname, "../.env") })

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  const address = process.argv[2] || "0x16E0e7141261Bbf34b4707Ced40EF0BB2F2a3720"

  console.log("Checking delegation for address:", address)
  console.log("Chain ID: 84532 (Base Sepolia)")
  console.log("")

  // Query delegations table
  const delegations = await sql`
    SELECT * FROM delegations
    WHERE LOWER(user_address) = LOWER(${address})
  `
  console.log("=== DELEGATIONS ===")
  if (delegations.length === 0) {
    console.log("No delegations found for this address")
  } else {
    console.log(JSON.stringify(delegations, null, 2))
  }

  // Also check agents table for this owner
  const agents = await sql`
    SELECT id, name, type, owner_address, agent_id_bytes, created_at
    FROM agents
    WHERE LOWER(owner_address) = LOWER(${address})
  `
  console.log("\n=== AGENTS ===")
  if (agents.length === 0) {
    console.log("No agents found for this owner")
  } else {
    console.log(JSON.stringify(agents, null, 2))
  }
}

main().catch(console.error)
