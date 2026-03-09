/**
 * Update SwapRouter contract with proper ABI including tuple components
 *
 * The BaseScan API sometimes returns ABIs without full tuple component details.
 * This script updates the SwapRouter contract with the correct ABI.
 *
 * Usage:
 *   pnpm tsx scripts/update-contract-metadata.ts
 */

import "dotenv/config"
import { db } from "../src/lib/db"
import { agentContracts } from "../src/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { extractFunctions } from "../src/lib/contracts/resolver"
import type { Abi } from "viem"

// SwapRouter02 complete ABI with tuple components
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
  {
    name: "exactInput",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "exactOutputSingle",
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
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  {
    name: "exactOutput",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "amountOut", type: "uint256" },
          { name: "amountInMaximum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  // Keep other non-tuple functions from the original ABI
  {
    name: "WETH9",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "approveMaxMinusOne",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "token", type: "address" }],
    outputs: [],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes[]" }],
    outputs: [{ name: "results", type: "bytes[]" }],
  },
  {
    name: "multicall",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "previousBlockhash", type: "bytes32" },
      { name: "data", type: "bytes[]" },
    ],
    outputs: [{ name: "", type: "bytes[]" }],
  },
  {
    name: "unwrapWETH9",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "unwrapWETH9WithFee",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "amountMinimum", type: "uint256" },
      { name: "feeBips", type: "uint256" },
      { name: "feeRecipient", type: "address" },
    ],
    outputs: [],
  },
  {
    name: "refundETH",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    name: "sweepToken",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amountMinimum", type: "uint256" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
] as const

const SWAP_ROUTER_ADDRESS = "0x94cc0aac535ccdb3c01d6787d6413c739ae12bc4"
const CRE_TEST_BOT_AGENT_ID = "3dd8bd62-9b85-415f-a5b0-8ddacd434828"

async function main() {
  console.log("=== Updating SwapRouter Contract Metadata ===\n")

  // Find the SwapRouter contract for CRE Test Bot
  const [contract] = await db
    .select()
    .from(agentContracts)
    .where(
      and(
        eq(agentContracts.agentId, CRE_TEST_BOT_AGENT_ID),
        eq(agentContracts.address, SWAP_ROUTER_ADDRESS)
      )
    )
    .limit(1)

  if (!contract) {
    console.log("SwapRouter contract not found for CRE Test Bot")
    process.exit(1)
  }

  console.log("Found contract:", contract.id)
  console.log("Current functions count:", contract.functions?.length)

  // Check current exactInputSingle function
  const currentFn = contract.functions?.find(
    (f: any) => f.name === "exactInputSingle"
  ) as any
  console.log(
    "\nCurrent exactInputSingle has components:",
    !!currentFn?.inputs?.[0]?.components
  )

  // Extract functions with proper tuple components
  const functions = extractFunctions(SWAP_ROUTER_ABI as unknown as Abi)

  console.log("\nNew functions with components:")
  const exactInputSingle = functions.find((f) => f.name === "exactInputSingle")
  console.log(JSON.stringify(exactInputSingle, null, 2))

  // Update the contract
  await db
    .update(agentContracts)
    .set({
      abi: SWAP_ROUTER_ABI as unknown as any,
      functions: functions as any,
    })
    .where(eq(agentContracts.id, contract.id))

  console.log("\n✅ SwapRouter contract updated with proper tuple components!")

  // Verify
  const [updated] = await db
    .select()
    .from(agentContracts)
    .where(eq(agentContracts.id, contract.id))
    .limit(1)

  const updatedFn = updated?.functions?.find(
    (f: any) => f.name === "exactInputSingle"
  ) as any
  console.log(
    "\nVerification - exactInputSingle has components:",
    !!updatedFn?.inputs?.[0]?.components
  )
  if (updatedFn?.inputs?.[0]?.components) {
    console.log("Components:", JSON.stringify(updatedFn.inputs[0].components))
  }

  process.exit(0)
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
