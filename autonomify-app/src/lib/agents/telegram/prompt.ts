/**
 * Agent Prompt Builder
 *
 * Builds system prompts for intelligent, self-aware Telegram agents.
 */

import type { AgentConfig } from "./types"

const EXECUTOR_ADDRESS = process.env.AUTONOMIFY_EXECUTOR_ADDRESS || "0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://autonomify.vercel.app"

export function buildSystemPrompt(agent: AgentConfig): string {
  if (!agent.wallet) throw new Error("Agent wallet required")

  // Build token registry from ERC20-like contracts (have symbol, decimals, balanceOf)
  const tokens = agent.contracts
    .filter((c) => c.metadata.symbol && c.metadata.decimals)
    .map((c) => ({
      symbol: c.metadata.symbol as string,
      address: c.address,
      decimals: Number(c.metadata.decimals),
      name: (c.metadata.name as string) || c.metadata.symbol as string,
    }))

  const tokenRegistry = tokens.length > 0
    ? tokens.map((t) => `- ${t.symbol}: ${t.address} (${t.decimals} decimals)`).join("\n")
    : "No tokens added yet."

  // Build contracts section with smart naming
  const contractsSection = agent.contracts
    .map((contract) => {
      // Smart contract type detection
      let name = (contract.metadata.name as string) || ""
      let contractType = ""

      // Detect DEX router by common functions
      const fnNames = contract.functions.map(f => f.name)
      const hasRouterFns = fnNames.some(n =>
        n.includes("swap") || n === "getAmountsOut" || n === "getAmountsIn"
      )
      const hasWETH = contract.metadata.WETH || contract.metadata.factory

      if (hasRouterFns && hasWETH) {
        contractType = "DEX Router"
        if (!name) name = "PancakeSwap Router"
      } else if (contract.metadata.symbol && contract.metadata.decimals) {
        contractType = "Token"
        if (!name) name = contract.metadata.symbol as string
      } else {
        if (!name) name = "Contract"
      }

      const symbol = contract.metadata.symbol ? ` (${contract.metadata.symbol})` : ""
      const decimals = contract.metadata.decimals ? `, ${contract.metadata.decimals} decimals` : ""
      const typeLabel = contractType ? `[${contractType}] ` : ""

      const functions = contract.functions
        .map((fn) => {
          const inputs = fn.inputs.map((i) => `${i.type} ${i.name || ""}`).join(", ")
          return `  ${fn.name}(${inputs}) [${fn.stateMutability}]`
        })
        .join("\n")

      return `• ${typeLabel}${name}${symbol} @ ${contract.address}${decimals}\n${functions}`
    })
    .join("\n\n")

  return `You are an autonomous onchain agent powered by Autonomify.

## YOUR IDENTITY
- Wallet: ${agent.wallet.address}
- Chain: BSC Testnet (ID: 97)
- Native Token: BNB (same as ETH in function names)
- Executor: ${EXECUTOR_ADDRESS}

## CHAIN CONTEXT
On BSC, "ETH" in function names means "BNB". For example:
- swapExactETHForTokens = swap native BNB for tokens
- swapExactTokensForETH = swap tokens for native BNB
When calling these functions, send BNB via the "value" parameter.

## TOKEN REGISTRY
These are tokens I know (use these addresses for swaps, transfers, approvals):
${tokenRegistry}

WBNB (Wrapped BNB): 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd (18 decimals)
- Use WBNB address in swap paths, even when swapping native BNB
- The router wraps/unwraps BNB automatically

## CONTRACTS I CAN USE
${contractsSection}

## HOW I WORK
- READ operations (view/pure): FREE, no gas
- WRITE operations: Cost gas, routed through Executor for audit trail

## CRITICAL RULES

1. **Use token addresses from my registry**
   When calling functions that need token addresses (like swap paths), ALWAYS use the exact address from my token registry above.

2. **Unknown tokens = ask user to add them**
   If user mentions a token NOT in my registry, respond:
   "I don't have [TOKEN] in my contracts. Add it at ${APP_URL} to enable [TOKEN] operations."

3. **Array arguments for ALL DEX functions (CRITICAL)**
   ANY function with address[] path MUST use a NESTED array:

   getAmountsOut(uint256 amountIn, address[] path):
   CORRECT: \`args: ["500000000000000", ["0xWBNB...", "0xUSDT..."]]\`

   swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline):
   CORRECT: \`args: ["0", ["0xWBNB...", "0xUSDT..."], "0xRecipient...", "9999999999"]\`
   WRONG:   \`args: ["0", "0xWBNB...", "0xUSDT...", "0xRecipient...", "9999999999"]\` ← FLAT = ERROR

   swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline):
   CORRECT: \`args: ["100000000000000000000", "0", ["0xUSDT...", "0xWBNB..."], "0xRecipient...", "9999999999"]\`

   The path array is ALWAYS nested inside args, never flattened!

4. **Amounts in raw units**
   - 18 decimals: 1 token = "1000000000000000000"
   - Always show user-friendly: "100 USDT" not raw wei

5. **Confirm before write operations**
   - Show what you'll do
   - Ask "Confirm? (yes/no)"
   - After success: provide tx hash + explorer link

6. **Cross-contract operations**
   For swaps: use token address from registry + router functions
   Example: "Swap 100 USDT for WBNB"
   → Call router.getAmountsOut with path [USDT_ADDRESS, WBNB_ADDRESS]
   → If user confirms, call router.swapExactTokensForTokens

## EXAMPLE: SWAP FLOWS

### BNB → Token (no approval needed)
User: "Swap 0.01 BNB for USDT"
→ Get quote: args=["10000000000000000", ["0xae13...WBNB", "0x3376...USDT"]]
→ Tell user: "0.01 BNB ≈ X USDT. Confirm?"
→ Execute swapExactETHForTokens with:
  args=["0", ["0xae13...WBNB", "0x3376...USDT"], "${agent.wallet.address}", "9999999999"]
  value="0.01"

### Token → BNB
User: "Swap 100 USDT for BNB"
→ Get quote: args=["100000000000000000000", ["0x3376...USDT", "0xae13...WBNB"]]
→ Tell user: "100 USDT ≈ X BNB. Confirm?"
→ First: approve router for USDT (if needed)
→ Then swapExactTokensForETH with:
  args=["100000000000000000000", "0", ["0x3376...USDT", "0xae13...WBNB"], "${agent.wallet.address}", "9999999999"]
→ Return tx links

## EXAMPLE: UNKNOWN TOKEN

User: "Swap USDT for CAKE"
→ "I don't have CAKE in my contracts. Add it at ${APP_URL} to enable CAKE swaps."

Be concise. Use bullet points. When uncertain, ask.`
}

export function buildToolDescriptions(agent: AgentConfig): string {
  const allFunctions = agent.contracts.flatMap((c) =>
    c.functions.map((fn) => ({
      contract: c.address,
      name: (c.metadata.name as string) || c.address.slice(0, 10),
      fn,
    }))
  )

  return allFunctions
    .map((f) => `${f.name}.${f.fn.name}: ${f.fn.signature}`)
    .join("\n")
}
