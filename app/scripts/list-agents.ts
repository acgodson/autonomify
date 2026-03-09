import "dotenv/config"
import { db } from "../src/lib/db"
import { agents, agentContracts, autonomifiedContracts } from "../src/lib/db/schema"

async function main() {
  const allAgents = await db.select().from(agents)
  console.log("Agents in DB:", allAgents.length)
  console.log(JSON.stringify(allAgents, null, 2))

  const allContracts = await db.select().from(agentContracts)
  console.log("\nAgent Contracts in DB:", allContracts.length)
  console.log(JSON.stringify(allContracts, null, 2))

  const allAutonomified = await db.select({
    address: autonomifiedContracts.address,
    chainId: autonomifiedContracts.chainId,
    hasAnalysis: autonomifiedContracts.analysis,
    createdAt: autonomifiedContracts.createdAt,
  }).from(autonomifiedContracts)
  console.log("\nAutonomified Contracts:", allAutonomified.length)
  allAutonomified.forEach(c => {
    console.log(`- ${c.address} (chain: ${c.chainId}, analysis: ${c.hasAnalysis ? 'yes' : 'no'})`)
  })

  process.exit(0)
}
main()
