/**
 * Setup Demo Agent
 *
 * Adds all demo contracts to CRE Test Bot agent.
 * Uses cached data from autonomified_contracts table.
 */

import "dotenv/config"
import { db } from "../src/lib/db"
import { agents, agentContracts, autonomifiedContracts } from "../src/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { resolveContract } from "../src/lib/contracts/resolver"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

const AGENT_ID = "3dd8bd62-9b85-415f-a5b0-8ddacd434828" // CRE Test Bot
const CHAIN_ID = 84532

// Demo contracts to add
const DEMO_CONTRACTS = [
  "0x4200000000000000000000000000000000000006", // WETH
  "0xC5290058841028F1614F3A6F0F5816cAd0df5E27", // QuoterV2
  "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4", // SwapRouter02
]

async function analyzeContract(contract: any) {
  const metadataStr = Object.entries(contract.metadata || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")

  const functionsStr = (contract.functions as any[])
    .map((f) => {
      const inputs = f.inputs.map((i: any) => `${i.type} ${i.name || ""}`).join(", ")
      const outputs = f.outputs.map((o: any) => o.type).join(", ")
      return `- ${f.name}(${inputs})${outputs ? ` -> ${outputs}` : ""} [${f.stateMutability}]`
    })
    .join("\n")

  const prompt = `Analyze this smart contract and provide insights.

Contract Address: ${contract.address}

Metadata:
${metadataStr || "None available"}

Functions:
${functionsStr}

Respond with a JSON object containing:
1. "name": A short, descriptive name for this contract
2. "summary": A 1-2 sentence description
3. "contractType": The type (e.g., "ERC-20 Token", "DEX Router")
4. "capabilities": An array of 3-5 key things users can do
5. "functionDescriptions": An object mapping function names to brief descriptions

Only respond with valid JSON.`

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt,
    maxTokens: 1000,
  })

  let cleanedText = result.text.trim()
  if (cleanedText.startsWith("```")) {
    cleanedText = cleanedText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }
  return JSON.parse(cleanedText)
}

async function main() {
  console.log("Setting up demo agent with contracts...\n")

  // Check agent exists
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, AGENT_ID))
    .limit(1)

  if (!agent) {
    console.error("Agent not found:", AGENT_ID)
    process.exit(1)
  }

  console.log(`Agent: ${agent.name}`)
  console.log(`Owner: ${agent.ownerAddress}\n`)

  for (const address of DEMO_CONTRACTS) {
    const normalizedAddress = address.toLowerCase()
    console.log(`\nProcessing ${address}...`)

    // Check if already added to agent
    const [existing] = await db
      .select()
      .from(agentContracts)
      .where(
        and(
          eq(agentContracts.agentId, AGENT_ID),
          eq(agentContracts.address, normalizedAddress)
        )
      )
      .limit(1)

    if (existing) {
      console.log("  Already added to agent, skipping")
      continue
    }

    // Check if autonomified
    let [cached] = await db
      .select()
      .from(autonomifiedContracts)
      .where(
        and(
          eq(autonomifiedContracts.address, normalizedAddress),
          eq(autonomifiedContracts.chainId, CHAIN_ID)
        )
      )
      .limit(1)

    if (!cached) {
      console.log("  Not autonomified, resolving...")
      const resolved = await resolveContract({ chainId: CHAIN_ID, address })

      // Analyze
      console.log("  Analyzing contract...")
      const analysis = await analyzeContract({
        address: normalizedAddress,
        metadata: resolved.metadata,
        functions: resolved.functions,
      })
      console.log(`  Analysis: ${analysis.name} (${analysis.contractType})`)

      // Save to cache
      await db.insert(autonomifiedContracts).values({
        address: normalizedAddress,
        chainId: CHAIN_ID,
        chainConfig: resolved.chain as any,
        abi: resolved.abi as any,
        metadata: resolved.metadata,
        functions: resolved.functions as any,
        analysis: analysis as any,
      })

      // Re-fetch
      ;[cached] = await db
        .select()
        .from(autonomifiedContracts)
        .where(
          and(
            eq(autonomifiedContracts.address, normalizedAddress),
            eq(autonomifiedContracts.chainId, CHAIN_ID)
          )
        )
        .limit(1)
    }

    if (!cached) {
      console.error("  Failed to get cached contract")
      continue
    }

    // Add to agent
    console.log("  Adding to agent...")
    await db.insert(agentContracts).values({
      agentId: AGENT_ID,
      address: normalizedAddress,
      chainId: CHAIN_ID,
      chainConfig: cached.chainConfig,
      abi: cached.abi,
      metadata: cached.metadata,
      functions: cached.functions,
      analysis: cached.analysis,
    })

    const analysis = cached.analysis as any
    console.log(`  ✅ Added: ${analysis?.name || normalizedAddress}`)
  }

  // List final contracts
  console.log("\n" + "=".repeat(50))
  console.log("Final agent contracts:")
  const allContracts = await db
    .select({
      address: agentContracts.address,
      analysis: agentContracts.analysis,
    })
    .from(agentContracts)
    .where(eq(agentContracts.agentId, AGENT_ID))

  allContracts.forEach((c) => {
    const analysis = c.analysis as any
    console.log(`  - ${analysis?.name || c.address} (${c.address.slice(0, 10)}...)`)
  })

  console.log("\nDone!")
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
