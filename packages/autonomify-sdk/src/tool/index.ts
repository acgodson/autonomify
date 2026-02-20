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

## Transaction Safety

Before ANY write operation (transfers, swaps, approvals):

1. Show exactly what you're about to do
2. Show amounts in human format (e.g., "100 USDT" not "100000000000000000000")
3. Ask for confirmation
4. After success, provide transaction hash and explorer link

## Error Handling

- Explain failures in simple terms
- Suggest alternatives when possible
- Never retry failed transactions without consent

---

## Tool: autonomify_execute

You have ONE tool for ALL contract interactions.

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

1. Arrays stay as arrays: \`["0x...", "0x..."]\`
2. Numbers as strings: \`"1000000000000000000"\`
3. Use exact parameter names from function signature
4. \`value\` in native units: \`"0.01"\` = 0.01 of native token

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
        return `- ${fn.name}(${params}) [${fn.stateMutability}]`
      })
      .join("\n")

    const pattern = detectPattern(contract.functions)
    let contractSection = `### ${contract.name}\nAddress: \`${address}\``

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

## Your Contracts

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
