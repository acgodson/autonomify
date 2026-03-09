import "dotenv/config"
import { db } from "../src/lib/db"
import { agentContracts } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"
import { resolveMetadata } from "../src/lib/contracts/resolver"
import { getChainOrThrow } from "autonomify-sdk"
import type { Abi } from "viem"

const CONTRACT_ADDRESS = "0xe4ab69c077896252fafbd49efd26b5d171a32410"
const CHAIN_ID = 84532 // Base Sepolia

async function main() {
  console.log("Fetching current contract data...")

  const [contract] = await db
    .select()
    .from(agentContracts)
    .where(eq(agentContracts.address, CONTRACT_ADDRESS))

  if (!contract) {
    console.log("Contract not found in DB")
    process.exit(1)
  }

  console.log("Current metadata:", JSON.stringify(contract.metadata, null, 2))

  const chain = getChainOrThrow(CHAIN_ID)
  const abi = contract.abi as Abi

  console.log("\nFetching fresh metadata via RPC...")
  const newMetadata = await resolveMetadata(chain, CONTRACT_ADDRESS, abi)
  console.log("New metadata:", JSON.stringify(newMetadata, null, 2))

  console.log("\nUpdating database...")
  await db
    .update(agentContracts)
    .set({ metadata: newMetadata })
    .where(eq(agentContracts.address, CONTRACT_ADDRESS))

  console.log("Done! Contract metadata updated.")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
