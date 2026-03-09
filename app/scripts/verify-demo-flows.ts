/**
 * Comprehensive Demo Flow Verification
 *
 * Tests all demo scenarios end-to-end to ensure encoding,
 * parsing, and execution work correctly.
 */

import "dotenv/config"
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import {
  createPublicClient,
  http,
  encodeFunctionData,
  formatUnits,
  getAddress,
  type Abi,
} from "viem"
import { db } from "../src/lib/db"
import { agents, agentContracts, delegations } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"
import {
  buildPrompt,
  getChainOrThrow,
  getBestRpcUrl,
  isReadOnly,
  type FunctionExport,
  type AutonomifyExport,
} from "autonomify-sdk"
import { triggerCRE } from "../src/lib/agent/cre"

const AGENT_ID = "3dd8bd62-9b85-415f-a5b0-8ddacd434828"

interface TestResult {
  name: string
  passed: boolean
  details: string
  txHash?: string
}

async function loadAgent() {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, AGENT_ID))
    .limit(1)

  if (!agent) throw new Error("Agent not found")

  const contracts = await db
    .select()
    .from(agentContracts)
    .where(eq(agentContracts.agentId, AGENT_ID))

  const [delegation] = await db
    .select()
    .from(delegations)
    .where(eq(delegations.userAddress, agent.ownerAddress))
    .limit(1)

  return { agent, contracts, delegation }
}

function buildExportData(
  agent: typeof agents.$inferSelect,
  contracts: (typeof agentContracts.$inferSelect)[]
): AutonomifyExport {
  const primaryContract = contracts[0]
  const chainId = primaryContract?.chainId || 84532
  const chain = getChainOrThrow(chainId)

  const contractsMap: AutonomifyExport["contracts"] = {}

  for (const contract of contracts) {
    const functions = contract.functions as FunctionExport[]
    const metadata = contract.metadata as Record<string, unknown>
    const analysis = contract.analysis as Record<string, unknown> | null

    const contractName =
      (metadata.name as string) ||
      (analysis?.name as string) ||
      contract.address.slice(0, 10)

    contractsMap[contract.address.toLowerCase() as `0x${string}`] = {
      name: contractName,
      abi: contract.abi as Abi,
      metadata: { ...metadata },
      functions: functions,
    }
  }

  return {
    version: "1.0.0",
    executor: {
      address: "0xd44Def7f75FeA04B402688ff14572129D2BeEb05" as `0x${string}`,
      abi: [],
    },
    chain: {
      id: chainId,
      name: chain.name,
      rpc: chain.rpc[0],
    },
    contracts: contractsMap,
  }
}

async function runTest(
  name: string,
  testFn: () => Promise<{ passed: boolean; details: string; txHash?: string }>
): Promise<TestResult> {
  console.log(`\n${"─".repeat(60)}`)
  console.log(`TEST: ${name}`)
  console.log("─".repeat(60))

  try {
    const result = await testFn()
    console.log(result.passed ? "✅ PASSED" : "❌ FAILED")
    console.log(`   ${result.details}`)
    if (result.txHash) {
      console.log(`   TX: https://sepolia.basescan.org/tx/${result.txHash}`)
    }
    return { name, ...result }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    console.log("❌ ERROR:", msg)
    return { name, passed: false, details: msg }
  }
}

async function main() {
  console.log("═".repeat(60))
  console.log("AUTONOMIFY DEMO FLOW VERIFICATION")
  console.log("═".repeat(60))

  const { agent, contracts, delegation } = await loadAgent()
  const exportData = buildExportData(agent, contracts)
  const chainId = contracts[0].chainId
  const rpcUrl = getBestRpcUrl(chainId)
  const client = createPublicClient({ transport: http(rpcUrl) })

  console.log(`\nAgent: ${agent.name}`)
  console.log(`Owner: ${agent.ownerAddress}`)
  console.log(`Delegation: ${delegation ? "✓" : "✗"}`)
  console.log(`Contracts: ${contracts.length}`)

  const results: TestResult[] = []

  // Test 1: Read LINK balance
  results.push(
    await runTest("Read LINK balance (balanceOf)", async () => {
      const linkContract = exportData.contracts["0xe4ab69c077896252fafbd49efd26b5d171a32410"]
      const balance = await client.readContract({
        address: "0xe4ab69c077896252fafbd49efd26b5d171a32410",
        abi: linkContract.abi,
        functionName: "balanceOf",
        args: [agent.ownerAddress],
      })
      const formatted = formatUnits(balance as bigint, 18)
      return {
        passed: true,
        details: `Balance: ${formatted} LINK`,
      }
    })
  )

  // Test 2: Read WETH balance
  results.push(
    await runTest("Read WETH balance (balanceOf)", async () => {
      const wethContract = exportData.contracts["0x4200000000000000000000000000000000000006"]
      const balance = await client.readContract({
        address: "0x4200000000000000000000000000000000000006",
        abi: wethContract.abi,
        functionName: "balanceOf",
        args: [agent.ownerAddress],
      })
      const formatted = formatUnits(balance as bigint, 18)
      return {
        passed: true,
        details: `Balance: ${formatted} WETH`,
      }
    })
  )

  // Test 3: Quote with tuple encoding (LINK → WETH)
  results.push(
    await runTest("Quote swap LINK→WETH (tuple encoding)", async () => {
      const quoterContract = exportData.contracts["0xc5290058841028f1614f3a6f0f5816cad0df5e27"]

      const result = await client.readContract({
        address: "0xc5290058841028f1614f3a6f0f5816cad0df5e27",
        abi: quoterContract.abi,
        functionName: "quoteExactInputSingle",
        args: [{
          tokenIn: "0xe4ab69c077896252fafbd49efd26b5d171a32410",
          tokenOut: "0x4200000000000000000000000000000000000006",
          amountIn: BigInt("100000000000000000"), // 0.1 LINK
          fee: 3000,
          sqrtPriceLimitX96: BigInt(0),
        }],
      }) as [bigint, bigint, number, bigint]

      const amountOut = formatUnits(result[0], 18)
      return {
        passed: true,
        details: `Quote: 0.1 LINK → ${amountOut} WETH`,
      }
    })
  )

  // Test 4: Simulate transfer via CRE
  results.push(
    await runTest("Simulate LINK transfer (CRE)", async () => {
      const linkContract = exportData.contracts["0xe4ab69c077896252fafbd49efd26b5d171a32410"]

      const calldata = encodeFunctionData({
        abi: linkContract.abi,
        functionName: "transfer",
        args: [getAddress("0xf2750684eb187fF9f82e2F980f6233707ef5768c"), BigInt("1000000000000000")], // 0.001 LINK
      })

      const result = await triggerCRE({
        userAddress: agent.ownerAddress,
        agentId: agent.agentIdBytes!,
        target: "0xe4ab69c077896252fafbd49efd26b5d171a32410",
        calldata,
        value: "0",
        permissionsContext: delegation?.signedDelegation || "0x",
        simulateOnly: true,
      })

      return {
        passed: result.success,
        details: result.success
          ? `Simulation passed, gas: ${(result as any).gasEstimate}`
          : `Simulation failed: ${(result as any).error?.type}`,
      }
    })
  )

  // Test 5: Execute transfer via CRE (only if simulation passed)
  const simPassed = results[results.length - 1].passed
  if (simPassed) {
    results.push(
      await runTest("Execute LINK transfer (CRE + ZK)", async () => {
        const linkContract = exportData.contracts["0xe4ab69c077896252fafbd49efd26b5d171a32410"]

        const calldata = encodeFunctionData({
          abi: linkContract.abi,
          functionName: "transfer",
          args: [getAddress("0xf2750684eb187fF9f82e2F980f6233707ef5768c"), BigInt("1000000000000000")], // 0.001 LINK
        })

        const result = await triggerCRE({
          userAddress: agent.ownerAddress,
          agentId: agent.agentIdBytes!,
          target: "0xe4ab69c077896252fafbd49efd26b5d171a32410",
          calldata,
          value: "0",
          permissionsContext: delegation?.signedDelegation || "0x",
          simulateOnly: false,
        })

        if (result.success && (result as any).txHash) {
          return {
            passed: true,
            details: `TX Status: ${(result as any).txStatusName}`,
            txHash: (result as any).txHash,
          }
        } else {
          return {
            passed: false,
            details: `Execution failed: ${JSON.stringify((result as any).error)}`,
          }
        }
      })
    )
  }

  // Summary
  console.log("\n" + "═".repeat(60))
  console.log("SUMMARY")
  console.log("═".repeat(60))

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  results.forEach(r => {
    console.log(`${r.passed ? "✅" : "❌"} ${r.name}`)
  })

  console.log(`\nTotal: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    console.log("\n⚠️  Some tests failed. Review the output above.")
    process.exit(1)
  } else {
    console.log("\n✅ All tests passed! Demo flows verified.")
    process.exit(0)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
