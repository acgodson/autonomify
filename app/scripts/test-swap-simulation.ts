/**
 * Test Script: Swap Simulation via CRE
 *
 * This script directly tests swap simulation without going through the LLM,
 * to verify the exact calldata format that works with CRE.
 *
 * Usage:
 *   pnpm tsx scripts/test-swap-simulation.ts
 */

import "dotenv/config"
import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseUnits,
  getAddress,
  type Abi,
} from "viem"
import { db } from "../src/lib/db"
import { agents, agentContracts, delegations } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"
import { triggerCRE } from "../src/lib/agent/cre"
import { getChainOrThrow, argsToArray, type AutonomifyExport } from "autonomify-sdk"

// Contract addresses on Base Sepolia
const CONTRACTS = {
  LINK: "0xe4ab69c077896252fafbd49efd26b5d171a32410",
  WETH: "0x4200000000000000000000000000000000000006",
  QUOTER: "0xc5290058841028f1614f3a6f0f5816cad0df5e27",
  SWAP_ROUTER: "0x94cc0aac535ccdb3c01d6787d6413c739ae12bc4",
}

// SwapRouter02 exactInputSingle ABI
const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const

// LINK Token ABI (for approve)
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

async function main() {
  console.log("=== Test: Swap Simulation via CRE ===\n")

  // Load the Telegram agent specifically
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, "3dd8bd62-9b85-415f-a5b0-8ddacd434828"))
    .limit(1)
  if (!agent) throw new Error("No agent found")

  console.log(`Agent: ${agent.name}`)
  console.log(`Owner: ${agent.ownerAddress}`)
  console.log(`Agent ID: ${agent.agentIdBytes}\n`)

  // Load delegation
  const chainId = 84532 // Base Sepolia
  const [delegation] = await db
    .select()
    .from(delegations)
    .where(eq(delegations.userAddress, agent.ownerAddress.toLowerCase()))
    .limit(1)

  if (!delegation) throw new Error("No delegation found")
  console.log(`Delegation found: ${delegation.signedDelegation.slice(0, 20)}...`)

  // Get RPC
  const chain = getChainOrThrow(chainId)
  const rpcUrl = chain.rpc[0]
  const client = createPublicClient({ transport: http(rpcUrl) })

  // Parameters for swap
  const amountIn = parseUnits("0.01", 18) // 0.01 LINK
  const ownerAddress = getAddress(agent.ownerAddress)

  console.log("\n--- Test 1: Direct Calldata Encoding ---")

  // Encode exactInputSingle with tuple params
  const swapParams = {
    tokenIn: getAddress(CONTRACTS.LINK),
    tokenOut: getAddress(CONTRACTS.WETH),
    fee: 3000, // 0.3%
    recipient: ownerAddress,
    amountIn: amountIn,
    amountOutMinimum: 0n, // No slippage protection for test
    sqrtPriceLimitX96: 0n,
  }

  console.log("Swap params:", swapParams)

  const swapCalldata = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [swapParams],
  })

  console.log(`Swap calldata: ${swapCalldata.slice(0, 50)}...`)

  // First, check allowance
  console.log("\n--- Test 2: Check LINK Allowance for SwapRouter ---")

  const allowance = await client.readContract({
    address: CONTRACTS.LINK as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [ownerAddress, getAddress(CONTRACTS.SWAP_ROUTER)],
  })

  console.log(`Current allowance: ${allowance}`)

  if (allowance < amountIn) {
    console.log("\n--- Test 3: Simulate LINK Approval ---")

    const approveCalldata = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [getAddress(CONTRACTS.SWAP_ROUTER), amountIn],
    })

    console.log(`Approve calldata: ${approveCalldata}`)

    const approveResult = await triggerCRE({
      userAddress: agent.ownerAddress,
      agentId: agent.agentIdBytes!,
      target: CONTRACTS.LINK as `0x${string}`,
      calldata: approveCalldata,
      value: "0",
      permissionsContext: delegation.signedDelegation,
      simulateOnly: true,
    })

    console.log("Approve simulation result:", JSON.stringify(approveResult, null, 2))

    if (!approveResult.success) {
      console.error("Approval simulation failed!")
      return
    }
  }

  // Now simulate the swap
  console.log("\n--- Test 4: Simulate Swap via CRE ---")

  const swapResult = await triggerCRE({
    userAddress: agent.ownerAddress,
    agentId: agent.agentIdBytes!,
    target: CONTRACTS.SWAP_ROUTER as `0x${string}`,
    calldata: swapCalldata,
    value: "0",
    permissionsContext: delegation.signedDelegation,
    simulateOnly: true,
  })

  console.log("Swap simulation result:", JSON.stringify(swapResult, null, 2))

  if (swapResult.success && swapResult.mode === "simulation") {
    console.log("\n✅ Swap simulation PASSED!")
    console.log(`   Gas estimate: ${swapResult.gasEstimate}`)
  } else {
    console.log("\n❌ Swap simulation FAILED!")
    console.log(`   Error: ${JSON.stringify(swapResult.error)}`)
  }

  // Test how argsToArray handles this
  console.log("\n--- Test 5: SDK argsToArray Behavior ---")

  // Build export data similar to what the bot would have
  const exportData: AutonomifyExport = {
    version: "1.0.0",
    executor: {
      address: "0xD44def7f75Fea04B402688ff14572129D2BEeb05" as `0x${string}`,
      abi: [],
    },
    chain: { id: chainId, name: "Base Sepolia", rpc: rpcUrl },
    contracts: {
      [CONTRACTS.SWAP_ROUTER.toLowerCase() as `0x${string}`]: {
        name: "SwapRouter02",
        abi: SWAP_ROUTER_ABI,
        metadata: {},
        functions: [
          {
            name: "exactInputSingle",
            stateMutability: "payable",
            inputs: [
              {
                name: "params",
                type: "tuple",
                components: [
                  { name: "tokenIn", type: "address" },
                  { name: "tokenOut", type: "address" },
                  { name: "fee", type: "uint24" },
                  { name: "recipient", type: "address" },
                  { name: "amountIn", type: "uint256" },
                  { name: "amountOutMinimum", type: "uint256" },
                  { name: "sqrtPriceLimitX96", type: "uint160" },
                ],
              },
            ],
            outputs: [{ name: "amountOut", type: "uint256" }],
          },
        ],
      },
    },
  }

  // Test with args in the format the LLM would send
  const llmStyleArgs = {
    params: {
      tokenIn: CONTRACTS.LINK,
      tokenOut: CONTRACTS.WETH,
      fee: "3000",
      recipient: agent.ownerAddress,
      amountIn: "10000000000000000", // 0.01 in wei
      amountOutMinimum: "0",
      sqrtPriceLimitX96: "0",
    },
  }

  console.log("LLM-style args:", JSON.stringify(llmStyleArgs, null, 2))

  try {
    const argsArray = argsToArray(
      exportData,
      CONTRACTS.SWAP_ROUTER.toLowerCase() as `0x${string}`,
      "exactInputSingle",
      llmStyleArgs
    )
    console.log("argsToArray result:", argsArray)

    // Now encode with these args
    const calldataFromArgsToArray = encodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      functionName: "exactInputSingle",
      args: argsArray as any,
    })
    console.log(`Calldata from argsToArray: ${calldataFromArgsToArray.slice(0, 50)}...`)

    // Compare
    console.log(`\nCalldata matches direct encoding: ${calldataFromArgsToArray === swapCalldata}`)
  } catch (err) {
    console.error("argsToArray error:", err)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
