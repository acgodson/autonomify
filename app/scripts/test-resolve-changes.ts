import "dotenv/config"
import { resolveContract } from "../src/lib/contracts/resolver"

const QUOTER_ADDRESS = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27"
const CHAIN_ID = 84532

async function main() {
  console.log("Testing resolveContract with tuple support...\n")

  const resolved = await resolveContract({ chainId: CHAIN_ID, address: QUOTER_ADDRESS })

  console.log("Contract resolved successfully!")
  console.log("Functions:", resolved.functions.length)

  // Check quoteExactInputSingle
  const quoteFn = resolved.functions.find((f) => f.name === "quoteExactInputSingle")
  if (!quoteFn) {
    console.error("ERROR: quoteExactInputSingle not found!")
    process.exit(1)
  }

  console.log("\n=== quoteExactInputSingle ===")
  console.log("Inputs:")
  quoteFn.inputs.forEach((input) => {
    console.log(`  - ${input.name}: ${input.type}`)
    if (input.components) {
      console.log("    Components:")
      input.components.forEach((c) => {
        console.log(`      - ${c.name}: ${c.type}`)
      })
    }
  })

  // Verify components exist
  const paramsInput = quoteFn.inputs.find((i) => i.name === "params")
  if (!paramsInput) {
    console.error("ERROR: params input not found!")
    process.exit(1)
  }

  if (!paramsInput.components || paramsInput.components.length === 0) {
    console.error("ERROR: params has no components! Tuple encoding will fail.")
    process.exit(1)
  }

  console.log("\n✅ PASS: Tuple components correctly extracted!")
  console.log(`   Found ${paramsInput.components.length} struct fields:`)
  paramsInput.components.forEach((c) => {
    console.log(`   - ${c.name} (${c.type})`)
  })

  // Also check the ABI
  console.log("\n=== Raw ABI check ===")
  const abiQuoteFn = (resolved.abi as any[]).find((f) => f.name === "quoteExactInputSingle")
  if (abiQuoteFn && abiQuoteFn.inputs[0]?.components) {
    console.log("✅ ABI also has components:", abiQuoteFn.inputs[0].components.length)
  } else {
    console.error("ERROR: ABI missing components!")
    process.exit(1)
  }

  console.log("\n=== Test Complete ===")
  process.exit(0)
}
main().catch((err) => {
  console.error("Test failed:", err)
  process.exit(1)
})
