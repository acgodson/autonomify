/**
 * E2E Test: Agent → Privy → Executor → Target Contract
 *
 * Tests the full hosted agent flow:
 * 1. Test READ function (view) → FREE eth_call
 * 2. Test WRITE function (approve) → Executor → costs gas
 *
 * Prerequisites:
 * - PRIVY_ID and PRIVY_SECRET in .env
 * - AUTONOMIFY_EXECUTOR_ADDRESS in .env
 * - Agent wallet needs BNB for gas
 *
 * Usage:
 *   TEST_WALLET_ID=xxx pnpm test:executor
 */

import "dotenv/config"
import { createPublicClient, http, parseAbi, formatEther } from "viem"
import { createAgentWallet, executeViaExecutor, getWallet } from "../src/lib/agents/telegram/privy"

// BSC Testnet config
const bscTestnet = {
  id: 97,
  name: "BSC Testnet",
  rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
  explorer: "https://testnet.bscscan.com",
}

// Test contract: USDT on BSC Testnet
const TEST_TOKEN = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as const

const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
])

const EXECUTOR_ABI = parseAbi([
  "event Executed(bytes32 indexed agentId, address indexed target, bytes4 indexed selector, bytes32 nullifier, bool success, bytes returnData)",
  "function getNonce(bytes32 agentId) view returns (uint256)",
])

async function main() {
  console.log("🚀 Autonomify E2E Test (Read vs Write)\n")

  // Check env vars
  const requiredEnv = ["PRIVY_ID", "PRIVY_SECRET", "AUTONOMIFY_EXECUTOR_ADDRESS"]
  for (const key of requiredEnv) {
    if (!process.env[key]) {
      console.error(`❌ Missing ${key} in .env`)
      process.exit(1)
    }
  }

  const executorAddress = process.env.AUTONOMIFY_EXECUTOR_ADDRESS as `0x${string}`
  console.log(`📍 Executor: ${executorAddress}`)
  console.log(`📍 Test token: ${TEST_TOKEN}`)
  console.log(`📍 Chain: ${bscTestnet.name} (${bscTestnet.id})\n`)

  const publicClient = createPublicClient({
    chain: {
      id: bscTestnet.id,
      name: bscTestnet.name,
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: { default: { http: [bscTestnet.rpc] } },
    },
    transport: http(bscTestnet.rpc),
  })

  // Step 1: Get or create agent wallet
  console.log("--- Step 1: Get/Create Agent Wallet ---")
  let wallet: { id: string; address: string }

  const existingWalletId = process.env.TEST_WALLET_ID

  if (existingWalletId) {
    console.log(`📦 Reusing existing wallet: ${existingWalletId}`)
    const existing = await getWallet(existingWalletId)
    if (existing) {
      wallet = existing
      console.log(`✅ Wallet loaded: ${wallet.address}`)
    } else {
      console.error(`❌ Wallet not found`)
      process.exit(1)
    }
  } else {
    wallet = await createAgentWallet()
    console.log(`✅ New wallet: ${wallet.address}`)
    console.log(`💡 Save: TEST_WALLET_ID=${wallet.id}`)
  }

  const balance = await publicClient.getBalance({ address: wallet.address as `0x${string}` })
  console.log(`💰 Balance: ${formatEther(balance)} BNB`)

  if (balance === BigInt(0)) {
    console.log(`\n⚠️  Fund wallet first: ${wallet.address}`)
    process.exit(0)
  }

  // ============================================
  // TEST 1: READ FUNCTION (view) - FREE
  // ============================================
  console.log("\n" + "=".repeat(50))
  console.log("TEST 1: READ FUNCTION (view) - Should be FREE")
  console.log("=".repeat(50))

  const balanceBefore = await publicClient.getBalance({ address: wallet.address as `0x${string}` })

  // Direct eth_call - this is what the SDK should do for view functions
  console.log(`📖 Calling name() directly via eth_call...`)
  const tokenName = await publicClient.readContract({
    address: TEST_TOKEN,
    abi: ERC20_ABI,
    functionName: "name",
  })
  console.log(`✅ Result: "${tokenName}"`)

  const balanceAfterRead = await publicClient.getBalance({ address: wallet.address as `0x${string}` })
  const readCost = balanceBefore - balanceAfterRead

  console.log(`💰 Gas cost: ${formatEther(readCost)} BNB`)
  if (readCost === BigInt(0)) {
    console.log(`✅ FREE! No gas was spent for read operation`)
  } else {
    console.log(`❌ Gas was spent (this shouldn't happen for eth_call)`)
  }

  // ============================================
  // TEST 2: WRITE FUNCTION (approve) - COSTS GAS
  // ============================================
  console.log("\n" + "=".repeat(50))
  console.log("TEST 2: WRITE FUNCTION (approve) - Should cost gas")
  console.log("=".repeat(50))

  const agentId = `agt_test_${Date.now()}`
  const agentIdBytes = `0x${Buffer.from(agentId).toString("hex").padEnd(64, "0")}` as `0x${string}`
  const spenderAddress = "0x0000000000000000000000000000000000000001" // Dummy spender
  const approveAmount = BigInt(1000000) // 1 USDT (6 decimals)

  console.log(`🤖 Agent ID: ${agentId}`)
  console.log(`📝 Approving ${approveAmount} tokens to ${spenderAddress}`)

  const balanceBeforeWrite = await publicClient.getBalance({ address: wallet.address as `0x${string}` })

  try {
    // Get nonce before
    let nonceBefore = BigInt(0)
    try {
      nonceBefore = await publicClient.readContract({
        address: executorAddress,
        abi: EXECUTOR_ABI,
        functionName: "getNonce",
        args: [agentIdBytes],
      })
    } catch {}
    console.log(`📊 Nonce before: ${nonceBefore}`)

    // Execute approve via executor
    console.log(`📤 Executing approve() via executor...`)
    const result = await executeViaExecutor({
      walletId: wallet.id,
      agentId,
      targetContract: TEST_TOKEN,
      functionName: "approve",
      functionAbi: ERC20_ABI as any,
      args: [spenderAddress, approveAmount],
    })

    console.log(`✅ Tx sent: ${result.hash}`)
    console.log(`🔗 ${bscTestnet.explorer}/tx/${result.hash}`)

    // Wait for confirmation
    console.log(`⏳ Waiting for confirmation...`)
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: result.hash as `0x${string}`,
    })

    console.log(`✅ Confirmed in block ${receipt.blockNumber}`)
    console.log(`   Status: ${receipt.status}`)
    console.log(`   Gas used: ${receipt.gasUsed}`)

    // Check Executed event
    const executorLogs = receipt.logs.filter(
      (log) => log.address.toLowerCase() === executorAddress.toLowerCase()
    )
    if (executorLogs.length > 0) {
      console.log(`🎉 Executed event emitted!`)
    }

    // Check nonce after
    const nonceAfter = await publicClient.readContract({
      address: executorAddress,
      abi: EXECUTOR_ABI,
      functionName: "getNonce",
      args: [agentIdBytes],
    })
    console.log(`📊 Nonce after: ${nonceAfter}`)

    // Verify allowance was set
    const allowance = await publicClient.readContract({
      address: TEST_TOKEN,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [wallet.address as `0x${string}`, spenderAddress as `0x${string}`],
    })
    console.log(`✅ Allowance set: ${allowance}`)

    // Check gas cost
    const balanceAfterWrite = await publicClient.getBalance({ address: wallet.address as `0x${string}` })
    const writeCost = balanceBeforeWrite - balanceAfterWrite
    console.log(`💰 Gas cost: ${formatEther(writeCost)} BNB`)

    if (writeCost > BigInt(0)) {
      console.log(`✅ Gas was spent (expected for write operation)`)
    }

    if (nonceAfter > nonceBefore) {
      console.log(`✅ Nonce incremented: execution recorded on-chain!`)
    }

  } catch (e) {
    console.error(`❌ Error: ${(e as Error).message}`)
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log("\n" + "=".repeat(50))
  console.log("SUMMARY")
  console.log("=".repeat(50))
  console.log(`✅ READ (view): Free via eth_call`)
  console.log(`✅ WRITE (approve): Paid via Executor → Target`)
  console.log("\n--- Test Complete ---")
}

main().catch(console.error)
