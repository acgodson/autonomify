import "dotenv/config"
import { db } from "../src/lib/db"
import { autonomifiedContracts, agentContracts } from "../src/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { resolveContract } from "../src/lib/contracts/resolver"

const QUOTER_ADDRESS = "0xc5290058841028f1614f3a6f0f5816cad0df5e27"
const CHAIN_ID = 84532

async function main() {
  console.log("Deleting old QuoterV2 entry from autonomified_contracts...")

  await db
    .delete(autonomifiedContracts)
    .where(
      and(
        eq(autonomifiedContracts.address, QUOTER_ADDRESS),
        eq(autonomifiedContracts.chainId, CHAIN_ID)
      )
    )

  console.log("Re-resolving QuoterV2 contract...")

  const resolved = await resolveContract({ chainId: CHAIN_ID, address: QUOTER_ADDRESS })

  console.log("\nResolved contract:")
  console.log("- Functions:", resolved.functions.length)

  // Check for quoteExactInputSingle
  const quoteFn = resolved.functions.find((f) => f.name === "quoteExactInputSingle")
  if (quoteFn) {
    console.log("\nquoteExactInputSingle:")
    console.log("  Inputs:", JSON.stringify(quoteFn.inputs, null, 2))
  }

  // Check the ABI
  const abiQuoteFn = (resolved.abi as any[]).find((f) => f.name === "quoteExactInputSingle")
  if (abiQuoteFn) {
    console.log("\nABI quoteExactInputSingle inputs:")
    console.log(JSON.stringify(abiQuoteFn.inputs, null, 2))
  }

  // Save to autonomified_contracts
  console.log("\nSaving to autonomified_contracts...")
  await db.insert(autonomifiedContracts).values({
    address: QUOTER_ADDRESS,
    chainId: CHAIN_ID,
    chainConfig: resolved.chain as any,
    abi: resolved.abi as any,
    metadata: resolved.metadata,
    functions: resolved.functions as any,
    analysis: null, // Will be analyzed when added to agent
  })

  // Update the agent_contracts entry if exists
  const [agentContract] = await db
    .select()
    .from(agentContracts)
    .where(eq(agentContracts.address, QUOTER_ADDRESS))
    .limit(1)

  if (agentContract) {
    console.log("Updating agent_contracts entry...")
    await db
      .update(agentContracts)
      .set({
        abi: resolved.abi as any,
        functions: resolved.functions as any,
      })
      .where(eq(agentContracts.id, agentContract.id))
  }

  console.log("\nDone!")
  process.exit(0)
}
main().catch(console.error)
