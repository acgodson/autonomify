import "dotenv/config"
import { db } from "../src/lib/db"
import { delegations } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"

const CRE_TRIGGER_URL = process.env.CRE_TRIGGER_URL || "http://localhost:8080/trigger"

async function main() {
  // Get delegation
  const [delegation] = await db
    .select()
    .from(delegations)
    .where(eq(delegations.userAddress, "0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720"))
    .limit(1)

  if (!delegation) {
    console.error("No delegation found")
    process.exit(1)
  }

  console.log("Delegation found, length:", delegation.signedDelegation?.length)

  const payload = {
    userAddress: "0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720",
    agentId: "0xf282e595f2043e9da73b7907b8b3af06a69e5620aee69ce7e9796e2fd65e5beb",
    execution: {
      target: "0xe4ab69c077896252fafbd49efd26b5d171a32410",
      value: "0",
      // transfer(to, amount) - 0.01 LINK to 0xf275...
      calldata: "0xa9059cbb000000000000000000000000f2750684eb187ff9f82e2f980f6233707ef5768c000000000000000000000000000000000000000000000000002386f26fc10000"
    },
    permissionsContext: delegation.signedDelegation,
    simulateOnly: false,
  }

  console.log("\nSending to CRE (simulateOnly: true)...")
  console.log("Payload:", JSON.stringify(payload, null, 2).slice(0, 500) + "...")

  const response = await fetch(CRE_TRIGGER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  console.log("\nResponse status:", response.status, response.statusText)

  const result = await response.json()
  console.log("\nResult:", JSON.stringify(result, null, 2))

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
