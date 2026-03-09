import { neon } from "@neondatabase/serverless"
import * as dotenv from "dotenv"
import * as path from "path"
import { randomUUID } from "crypto"

dotenv.config({ path: path.join(__dirname, "../.env") })

const sql = neon(process.env.DATABASE_URL!)

const USER_ADDRESS = "0xf2750684eB187fF9f82e2F980f6233707eF5768C"
const EXECUTOR_ADDRESS = "0xD44def7f75Fea04B402688FF14572129D2BEeb05"
const CHAIN_ID = 84532 // Base Sepolia

async function main() {
  console.log("Setting up test agent for:", USER_ADDRESS)
  console.log("")

  // 1. Check if agent exists, create if not
  let agents = await sql`
    SELECT * FROM agents
    WHERE LOWER(owner_address) = LOWER(${USER_ADDRESS})
  `

  let agentId: string
  let agentIdBytes: string

  if (agents.length === 0) {
    // Create new agent
    agentId = randomUUID()
    agentIdBytes = `0x${agentId.replace(/-/g, "").padStart(64, "0")}`

    await sql`
      INSERT INTO agents (id, name, type, owner_address, agent_id_bytes)
      VALUES (${agentId}::uuid, 'Test DeFi Agent', 'telegram', ${USER_ADDRESS.toLowerCase()}, ${agentIdBytes})
    `
    console.log("✓ Created new agent:", agentId)
  } else {
    agentId = agents[0].id
    agentIdBytes = agents[0].agent_id_bytes || `0x${agentId.replace(/-/g, "").padStart(64, "0")}`

    // Update agent_id_bytes if missing
    if (!agents[0].agent_id_bytes) {
      await sql`
        UPDATE agents SET agent_id_bytes = ${agentIdBytes} WHERE id = ${agentId}::uuid
      `
      console.log("✓ Updated agent with agent_id_bytes")
    }
    console.log("✓ Using existing agent:", agentId)
  }

  console.log("  Agent ID Bytes:", agentIdBytes)

  // 2. Check/create agent policy
  const policies = await sql`
    SELECT * FROM agent_policies WHERE agent_id = ${agentId}::uuid
  `

  if (policies.length === 0) {
    await sql`
      INSERT INTO agent_policies (agent_id, user_address, daily_limit, tx_limit, policy_version, sync_status)
      VALUES (${agentId}::uuid, ${USER_ADDRESS.toLowerCase()}, '1000000000000000000', '100000000000000000', 1, 'synced')
    `
    console.log("✓ Created agent policy (1 ETH daily, 0.1 ETH per tx)")
  } else {
    console.log("✓ Agent policy already exists")
  }

  // 3. Check/create allowed contracts (allow executor itself for testing)
  const allowedContracts = await sql`
    SELECT * FROM agent_allowed_contracts WHERE agent_id = ${agentId}::uuid
  `

  if (allowedContracts.length === 0) {
    await sql`
      INSERT INTO agent_allowed_contracts (agent_id, contract_address, contract_name)
      VALUES (${agentId}::uuid, ${EXECUTOR_ADDRESS.toLowerCase()}, 'AutonomifyExecutor')
    `
    console.log("✓ Added executor to allowed contracts")
  } else {
    console.log("✓ Allowed contracts already configured")
  }

  // 4. Check delegation exists
  const delegations = await sql`
    SELECT * FROM delegations
    WHERE LOWER(user_address) = LOWER(${USER_ADDRESS})
    AND chain_id = ${CHAIN_ID}
  `

  if (delegations.length === 0) {
    console.log("⚠ No delegation found - user needs to sign delegation on frontend")
  } else {
    console.log("✓ Delegation exists for chain", CHAIN_ID)
  }

  // 5. Output the test payload
  console.log("")
  console.log("=== TEST PAYLOAD ===")
  const payload = {
    userAddress: USER_ADDRESS,
    agentId: agentId,
    execution: {
      target: EXECUTOR_ADDRESS,
      calldata: "0x",
      value: "0"
    },
    permissionsContext: delegations[0]?.signed_delegation || "DELEGATION_REQUIRED"
  }
  console.log(JSON.stringify(payload, null, 2))

  // 6. Write to test-payload-fresh.json
  const fs = await import("fs")
  const payloadPath = path.join(__dirname, "../../packages/autonomify-cre/test-payload-fresh.json")
  fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2))
  console.log("")
  console.log("✓ Written to:", payloadPath)

  console.log("")
  console.log("=== SUMMARY ===")
  console.log("Agent ID:", agentId)
  console.log("Agent ID Bytes:", agentIdBytes)
  console.log("Owner:", USER_ADDRESS)
  console.log("Chain:", CHAIN_ID, "(Base Sepolia)")
  console.log("")
  console.log("Now run: cd packages/autonomify-cre && npx tsx test-workflow.ts simulation")
}

main().catch(console.error)
