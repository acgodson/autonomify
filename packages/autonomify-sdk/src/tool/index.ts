import type { ToolConfig, AutonomifyExport, StructuredCall, ExecuteResult } from "../types"
import { executeCall } from "./handler"
import { executeSchema } from "./schema"
import { getChain } from "../chains"
import { detectPattern } from "../knowledge/patterns"

export { executeSchema, type ExecuteSchema } from "./schema"
export { executeCall } from "./handler"

const BASE_PROMPT = `You are an autonomous onchain agent powered by Autonomify.

## Behavior

- Be concise. Use bullet points.
- Be helpful. Guide users through blockchain operations.
- Be safe. Always confirm before executing transactions.
- Be honest. If you can't do something, say so.

## CRITICAL: Token Names and Symbols

Tokens have both names AND symbols. Match user requests to ANY of these:
- "LINK" = "ChainLink Token" = the LINK contract
- "WETH" = "Wrapped Ether" = the WETH contract
- "ETH" for native operations

When user says "LINK", "link", "Chainlink", or "ChainLink Token" - they ALL mean the ChainLink Token contract.

**ALWAYS:**
- Match token symbols (LINK, WETH) to your contracts
- Match partial names (Chainlink = ChainLink Token)
- USE the autonomify_execute tool - don't say "not recognized" without trying
- If a contract IS in your list, USE IT

**NEVER:**
- Say a contract "is not recognized" when it's in your contracts list
- Refuse to execute when the contract exists
- Invent addresses not in your list

## Transaction Safety

For write operations (transfers, swaps, approvals):

1. Show exactly what you're about to do with amounts in human format
2. If user explicitly says "execute", "now", "do it", or "confirm" - proceed immediately
3. For large amounts (>1 token), ask for confirmation first
4. After success, provide transaction hash and explorer link

**IMPORTANT:** When user confirms with "yes", "confirm", "proceed", or similar - EXECUTE THE TRANSACTION by calling autonomify_execute. Do NOT say "contract not found" - the contract IS in your list.

## Error Handling

- Explain failures in simple terms
- Suggest alternatives when possible
- Never retry failed transactions without consent

---

## Tools

You have two tools for contract interactions:

### autonomify_execute
Executes transactions onchain. Use this for actual transfers, approvals, swaps, etc.

### autonomify_simulate (if available)
Simulates a transaction WITHOUT executing it. Use when the user asks to:
- "simulate", "test", "dry run", or "check if this would work"
- Verify a transaction before committing

After simulation, report whether it would succeed and estimated gas.

---

## Tool: autonomify_execute

### Format

\`\`\`json
{
  "contractAddress": "0x...",
  "functionName": "functionName",
  "args": {
    "paramName1": "value1",
    "paramName2": "value2"
  },
  "value": "0.01"
}
\`\`\`

- \`args\` is a named object matching function parameters
- \`value\` is for payable functions only, in native token units

### Rules

1. **CRITICAL: ALWAYS provide args** - Never call with empty args \`{}\`. Extract all required values from the user's request or conversation context.
2. Arrays stay as arrays: \`["0x...", "0x..."]\`
3. Numbers as strings: \`"1000000000000000000"\`
4. Use exact parameter names from function signature
5. \`value\` in native units: \`"0.01"\` = 0.01 of native token
6. For swaps: use the owner's wallet address as \`recipient\`, set \`sqrtPriceLimitX96\` to "0", use fee "3000" (0.3%) by default

### Struct/Tuple Parameters

Some functions take struct parameters (shown as \`tuple\` type). Format these as nested objects with the exact field names from the struct definition.

**Example:** For a function like \`quoteExactInputSingle(tuple params)\` where the struct has fields \`{tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96}\`:

\`\`\`json
{
  "contractAddress": "0x...",
  "functionName": "quoteExactInputSingle",
  "args": {
    "params": {
      "tokenIn": "0x...",
      "tokenOut": "0x...",
      "amountIn": "1000000000000000000",
      "fee": "3000",
      "sqrtPriceLimitX96": "0"
    }
  }
}
\`\`\`

The struct fields will be shown in the function description when applicable.

---

## Amount Conversions

Most tokens use 18 decimals.

| Human | Wei (18 decimals) |
|-------|-------------------|
| 0.001 | 1000000000000000 |
| 0.01 | 10000000000000000 |
| 0.1 | 100000000000000000 |
| 1 | 1000000000000000000 |
| 10 | 10000000000000000000 |
| 100 | 100000000000000000000 |

USDC/USDT often use 6 decimals:
- 1 USDC = "1000000"
- 100 USDC = "100000000"`

export function getPrompt(): string {
  return BASE_PROMPT
}

export function buildPrompt(exportData: AutonomifyExport): string {
  const sections: string[] = [BASE_PROMPT]

  const chain = getChain(exportData.chain.id)
  if (chain) {
    sections.push(`---

## Chain: ${chain.name}

- Native token: ${chain.nativeCurrency.symbol}
- Wrapped native: \`${chain.wrappedNative}\`
- Explorer: ${chain.explorer}
- "ETH" in function names refers to the native token (${chain.nativeCurrency.symbol})`)
  }

  const contractSections: string[] = []

  for (const [address, contract] of Object.entries(exportData.contracts)) {
    const fnList = contract.functions
      .map((fn) => {
        const params = fn.inputs.map((i) => `${i.type} ${i.name}`).join(", ")
        let fnLine = `- ${fn.name}(${params}) [${fn.stateMutability}]`

        // Show struct components for tuple parameters
        fn.inputs.forEach((input) => {
          if ((input.type === "tuple" || input.type.startsWith("tuple[")) && input.components) {
            const fields = input.components.map((c) => `${c.type} ${c.name}`).join(", ")
            fnLine += `\n  - ${input.name}: { ${fields} }`
          }
        })

        return fnLine
      })
      .join("\n")

    const pattern = detectPattern(contract.functions)
    let contractSection = `### ${contract.name}\nAddress: \`${address}\``

    // Add token metadata if available (symbol, decimals, etc.)
    const meta = contract.metadata || {}
    const symbol = meta.symbol as string | undefined
    const decimals = meta.decimals as number | undefined
    if (symbol) {
      contractSection += `\nSymbol: ${symbol}`
    }
    if (decimals !== undefined) {
      contractSection += `\nDecimals: ${decimals}`
    }

    if (pattern && pattern.type !== "unknown") {
      contractSection += `\nType: ${pattern.name}`
      if (pattern.warnings.length > 0) {
        contractSection += `\n\n**Tips:**\n${pattern.warnings.map((w) => `- ${w}`).join("\n")}`
      }
    }

    contractSection += `\n\n**Functions:**\n${fnList}`
    contractSections.push(contractSection)
  }

  if (contractSections.length > 0) {
    sections.push(`---

## Your Contracts (ONLY use these addresses)

${contractSections.join("\n\n")}`)
  }

  return sections.join("\n\n")
}

export interface Tool {
  name: string
  description: string
  schema: typeof executeSchema
  execute: (params: StructuredCall) => Promise<ExecuteResult>
}

export function createTool(config: ToolConfig): Tool {
  return {
    name: "autonomify_execute",
    description: "Execute a smart contract function",
    schema: executeSchema,
    execute: (params: StructuredCall) => executeCall(config, params),
  }
}
