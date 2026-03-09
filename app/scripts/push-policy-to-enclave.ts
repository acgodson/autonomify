/**
 * Push policy config to the enclave for testing
 *
 * The enclave stores policies in-memory and needs them pushed before proof generation.
 */

import * as dotenv from "dotenv"
import * as path from "path"

dotenv.config({ path: path.join(__dirname, "../.env") })

const USER_ADDRESS = process.argv[2] || "0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720"
// CRE Test Bot agent ID bytes
const AGENT_ID = process.argv[3] || "0xf282e595f2043e9da73b7907b8b3af06a69e5620aee69ce7e9796e2fd65e5beb"

const ENCLAVE_URL = process.env.ENCLAVE_URL || "http://3.71.199.191:8001"

interface PolicyConfig {
  maxAmount?: {
    enabled: boolean
    limit: number
  }
  timeWindow?: {
    enabled: boolean
    startHour: number
    endHour: number
  }
  whitelist?: {
    enabled: boolean
    root?: string
    path?: string[]
    index?: number
  }
}

async function main() {
  console.log("Pushing policy config to enclave...")
  console.log("  Enclave URL:", ENCLAVE_URL)
  console.log("  User:", USER_ADDRESS)
  console.log("  Agent ID:", AGENT_ID)
  console.log("")

  // Policy config: 0.1 ETH max per tx, no time restrictions, no whitelist
  const policyConfig: PolicyConfig = {
    maxAmount: {
      enabled: true,
      limit: 100000000000000000, // 0.1 ETH in wei
    },
    timeWindow: {
      enabled: false,
      startHour: 0,
      endHour: 24,
    },
    whitelist: {
      enabled: false,
    },
  }

  const request = {
    type: "STORE_POLICY_CONFIG",
    userAddress: USER_ADDRESS,
    agentId: AGENT_ID,
    policyConfig,
  }

  console.log("Request:", JSON.stringify(request, null, 2))
  console.log("")

  try {
    const response = await fetch(ENCLAVE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    const result = await response.json()
    console.log("Response:", JSON.stringify(result, null, 2))

    if (result.success) {
      console.log("")
      console.log("✓ Policy pushed successfully!")
      console.log("")
      console.log("Now run: cd packages/autonomify-cre && npx tsx test-workflow.ts simulation")
    } else {
      console.error("✗ Failed to push policy:", result.error)
    }
  } catch (error) {
    console.error("✗ Failed to connect to enclave:", error)
    console.log("")
    console.log("Make sure the enclave is running:")
    console.log("  cd packages/autonomify-enclave && pnpm dev")
  }
}

main().catch(console.error)
