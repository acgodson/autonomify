/**
 * Test Policy Enforcement
 *
 * Direct test against the enclave to verify policy limits are enforced.
 * This script:
 * 1. Pushes a policy with 0.1 token limit to the enclave
 * 2. Tests proof generation with amounts above and below the limit
 * 3. Verifies that amounts exceeding the limit are rejected
 *
 * Usage:
 *   pnpm tsx scripts/test-policy-enforcement.ts
 */

import "dotenv/config"

const ENCLAVE_URL = process.env.ENCLAVE_URL || "http://3.71.199.191:8001"
const USER_ADDRESS = "0x16e0e7141261bbf34b4707ced40ef0bb2f2a3720"
const AGENT_ID = "0xf282e595f2043e9da73b7907b8b3af06a69e5620aee69ce7e9796e2fd65e5beb"
const RECIPIENT = "0xf2750684eB187fF9f82e2F980f6233707eF5768C"

// Test amounts in wei
const AMOUNT_OVER_LIMIT = "110000000000000000" // 0.11 tokens - should FAIL
const AMOUNT_UNDER_LIMIT = "50000000000000000"  // 0.05 tokens - should SUCCEED
const POLICY_LIMIT = 100000000000000000        // 0.1 tokens in wei

async function pushPolicy() {
  console.log("\n=== Step 1: Pushing Policy to Enclave ===")
  console.log("  Limit: 0.1 tokens (", POLICY_LIMIT, "wei)")

  const request = {
    type: "STORE_POLICY_CONFIG",
    userAddress: USER_ADDRESS,
    agentId: AGENT_ID,
    policyConfig: {
      maxAmount: {
        enabled: true,
        limit: POLICY_LIMIT,
      },
      timeWindow: {
        enabled: false,
        startHour: 0,
        endHour: 24,
      },
      whitelist: {
        enabled: false,
      },
    },
  }

  try {
    const response = await fetch(ENCLAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })

    const result = await response.json()
    console.log("  Response:", JSON.stringify(result, null, 2))

    if (result.success) {
      console.log("  ✓ Policy pushed successfully!")
      return true
    } else {
      console.error("  ✗ Failed to push policy:", result.error)
      return false
    }
  } catch (error) {
    console.error("  ✗ Failed to connect to enclave:", error)
    console.log("\n  Make sure the enclave is running:")
    console.log("    cd packages/autonomify-enclave && pnpm dev")
    return false
  }
}

async function checkHealth() {
  console.log("\n=== Checking Enclave Health ===")
  console.log("  URL:", ENCLAVE_URL)

  try {
    const response = await fetch(ENCLAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "HEALTH_CHECK" }),
    })

    const result = await response.json()
    console.log("  Status:", result.status)
    console.log("  Policy count:", result.policyCount)
    return result.status === "healthy"
  } catch (error) {
    console.error("  ✗ Enclave not reachable:", error)
    return false
  }
}

async function testProofGeneration(amount: string, description: string, shouldFail: boolean) {
  console.log(`\n=== Step ${shouldFail ? '3' : '4'}: Testing ${description} ===`)
  console.log(`  Amount: ${amount} wei (${Number(amount) / 1e18} tokens)`)
  console.log(`  Expected: ${shouldFail ? 'REJECT (exceeds limit)' : 'ALLOW (within limit)'}`)

  // Request proof generation
  const proofRequest = {
    type: "GENERATE_PROOF",
    userAddress: USER_ADDRESS,
    agentId: AGENT_ID,
    txData: {
      amount: amount,
      recipient: RECIPIENT,
      timestamp: Math.floor(Date.now() / 1000),
      userAddress: USER_ADDRESS,
    },
  }

  try {
    const response = await fetch(ENCLAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proofRequest),
    })

    const result = await response.json()

    if (shouldFail) {
      // We expect this to fail
      if (!result.success) {
        console.log(`  ✅ CORRECT: Proof rejected as expected`)
        console.log(`     Error: ${result.error}`)
        return true
      } else {
        console.log(`  ❌ BUG: Proof should have been rejected but was generated!`)
        console.log(`     Proof length: ${result.proof?.length || 0}`)
        return false
      }
    } else {
      // We expect this to succeed
      if (result.success) {
        console.log(`  ✅ CORRECT: Proof generated successfully`)
        console.log(`     Proof length: ${result.proof?.length || 0}`)
        return true
      } else {
        console.log(`  ❌ UNEXPECTED: Proof failed but should have succeeded`)
        console.log(`     Error: ${result.error}`)
        return false
      }
    }
  } catch (error) {
    console.error("  Request failed:", error)
    return false
  }
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗")
  console.log("║           POLICY ENFORCEMENT TEST                          ║")
  console.log("╚════════════════════════════════════════════════════════════╝")
  console.log("\nConfiguration:")
  console.log("  Enclave URL:", ENCLAVE_URL)
  console.log("  User:", USER_ADDRESS)
  console.log("  Agent:", AGENT_ID)
  console.log("  Policy Limit: 0.1 tokens (100000000000000000 wei)")

  // Step 0: Check health
  const healthy = await checkHealth()
  if (!healthy) {
    console.log("\n❌ Enclave not healthy. Aborting.")
    process.exit(1)
  }

  // Step 1: Push policy
  const policyPushed = await pushPolicy()
  if (!policyPushed) {
    console.log("\n❌ Failed to push policy. Aborting.")
    process.exit(1)
  }

  // Wait a moment for policy to be stored
  await new Promise(resolve => setTimeout(resolve, 500))

  // Step 2: Verify health again (check policy count)
  console.log("\n=== Step 2: Verifying Policy Stored ===")
  await checkHealth()

  // Step 3: Test amount OVER limit (should FAIL)
  const test1Passed = await testProofGeneration(AMOUNT_OVER_LIMIT, "0.11 tokens (OVER LIMIT)", true)

  // Step 4: Test amount UNDER limit (should SUCCEED)
  const test2Passed = await testProofGeneration(AMOUNT_UNDER_LIMIT, "0.05 tokens (UNDER LIMIT)", false)

  // Summary
  console.log("\n╔════════════════════════════════════════════════════════════╗")
  console.log("║                     TEST RESULTS                           ║")
  console.log("╚════════════════════════════════════════════════════════════╝")
  console.log(`  Over-limit rejection:   ${test1Passed ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`  Under-limit acceptance: ${test2Passed ? '✅ PASS' : '❌ FAIL'}`)
  console.log(`\n  Overall: ${test1Passed && test2Passed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)

  process.exit(test1Passed && test2Passed ? 0 : 1)
}

main().catch(error => {
  console.error("Fatal error:", error)
  process.exit(1)
})
