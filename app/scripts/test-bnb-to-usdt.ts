/**
 * Test BNB → USDT swap quote
 *
 * Uses swapExactETHForTokens which accepts native BNB
 */

import { createPublicClient, http, formatUnits, parseEther } from "viem"

const client = createPublicClient({
  transport: http("https://data-seed-prebsc-1-s1.bnbchain.org:8545"),
})

const ROUTER = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"
const USDT = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"
const WBNB = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd"

const ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
]

async function main() {
  console.log("🔄 Checking BNB → USDT swap quote\n")

  // Quote: 0.01 BNB → USDT
  // Path starts with WBNB because router wraps BNB internally
  const bnbAmount = parseEther("0.01")
  const path = [WBNB, USDT]

  console.log("Input: 0.01 BNB")
  console.log("Path: WBNB → USDT (router wraps BNB for you)\n")

  try {
    const amounts = await client.readContract({
      address: ROUTER,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [bnbAmount, path],
    })

    console.log("✅ Quote Result:")
    console.log(`   Input:  ${formatUnits(amounts[0], 18)} BNB`)
    console.log(`   Output: ${formatUnits(amounts[1], 18)} USDT`)

    const rate = Number(amounts[1]) / Number(amounts[0])
    console.log(`   Rate:   1 BNB ≈ ${rate.toFixed(2)} USDT`)

    console.log("\n📋 To execute swap with native BNB:")
    console.log("   Function: swapExactETHForTokens")
    console.log("   Args:")
    console.log(`     amountOutMin: "${amounts[1].toString()}"`)
    console.log(`     path: ["${WBNB}", "${USDT}"]`)
    console.log("     to: YOUR_WALLET")
    console.log("     deadline: UNIX_TIMESTAMP")
    console.log(`   value: "0.01" (BNB sent with transaction)`)

  } catch (error) {
    console.error("Error:", (error as Error).message)
  }
}

main()
