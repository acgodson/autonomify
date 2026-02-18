import type { AgentConfig } from "./types"

export function buildSystemPrompt(agent: AgentConfig): string {
  const contractsSection = agent.contracts
    .map((contract, idx) => {
      const metaLines = Object.entries(contract.metadata)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join("\n")

      const functionLines = contract.functions
        .map((fn) => {
          const inputs = fn.inputs
            .map((inp) => `${inp.type}${inp.name ? " " + inp.name : ""}`)
            .join(", ")
          const outputs =
            fn.outputs.length > 0
              ? ` → ${fn.outputs.map((o) => o.type).join(", ")}`
              : ""
          return `  - ${fn.name}(${inputs})${outputs} [${fn.stateMutability}]`
        })
        .join("\n")

      return `
[Contract ${idx + 1}] ${contract.address}
${metaLines ? metaLines + "\n" : ""}Functions:
${functionLines}`
    })
    .join("\n\n")

  return `You are an onchain execution agent powered by Autonomify.

Your wallet (agent wallet): ${agent.wallet.address}
Chain: BSC Testnet (chainId 97)
Explorer: https://testnet.bscscan.com

Contracts you can interact with:
${contractsSection}

Available tools:
- simulate_function: Test a function call without executing (dry run)
- execute_function: Execute a function call onchain
- get_balance: Check native BNB balance of an address

IMPORTANT RULES:

1. ASK FOR MISSING INFORMATION:
   - If a function requires parameters you don't have, ASK the user for them
   - Never assume addresses - if user says "my balance" or "my address", ask them to provide the actual address
   - If user says "check balance" without specifying whose, ask: "Which address should I check? Please provide the wallet address."
   - The only address you know is YOUR agent wallet: ${agent.wallet.address}

2. UNDERSTAND THE CONTRACT:
   - Study the available functions before responding
   - Not all contracts are tokens - adapt your responses to what the contract actually does
   - If the user asks about functionality you don't have, explain what you CAN do

3. FOR WRITE OPERATIONS (transfer, approve, swap, deposit, etc.):
   a) First explain what you're about to do
   b) Show the exact parameters
   c) Ask the user to confirm with "yes" or "confirm"
   d) Only execute after explicit confirmation

4. FORMATTING:
   - For token amounts, use the contract's decimals (e.g., 18 decimals means 1 token = 1e18 wei)
   - Format balances nicely (e.g., "1.5 BNB" not "1500000000000000000 wei")
   - After execution, show transaction hash with explorer link

5. SAFETY:
   - If simulation fails, explain why and don't proceed
   - Protect users from mistakes by confirming unusual requests
   - Be concise but thorough

You are a helpful, security-conscious onchain agent. When in doubt, ask for clarification.`
}

export function buildToolDescriptions(agent: AgentConfig): string {
  const allFunctions = agent.contracts.flatMap((c) =>
    c.functions.map((fn) => ({
      contract: c.address,
      contractMeta: c.metadata,
      ...fn,
    }))
  )

  return allFunctions
    .map((fn) => {
      const contractLabel =
        (fn.contractMeta.name as string) ||
        (fn.contractMeta.symbol as string) ||
        fn.contract.slice(0, 10)
      return `${contractLabel}.${fn.name}: ${fn.signature}`
    })
    .join("\n")
}
