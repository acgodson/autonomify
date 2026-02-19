/**
 * Telegram-Privy Agent
 *
 * Our reference implementation of an Autonomify agent.
 * Uses Telegram for the interface and Privy for wallet management.
 *
 * To build your own agent implementation:
 * 1. Import from @/lib/autonomify-core for contract resolution and tool export
 * 2. Implement your own wallet management (or use Privy like we do)
 * 3. Implement your own bot/interface (Discord, Slack, X, etc.)
 *
 * @example
 * ```typescript
 * import { createAgent, getAgent, execute } from "@/lib/agents/telegram-privy"
 *
 * // Create a new agent
 * const agent = await createAgent("My Bot", "telegram-token")
 *
 * // Execute a contract function
 * const result = await execute(agent, contract, {
 *   functionName: "transfer",
 *   args: ["0x...", "1000000000000000000"],
 * })
 * ```
 */

// Types
export type {
  AgentConfig,
  AgentWallet,
  AgentType,
  ExecuteParams,
  SimulateResult,
  ExecuteResult,
} from "./types"

// Agent Store
export {
  createAgent,
  getAgent,
  listAgents,
  updateAgent,
  deleteAgent,
  addContractToAgent,
  removeContractFromAgent,
  type CreateAgentOptions,
} from "./store"

// Executor
export { simulate, execute, getNativeBalance } from "./executor"

// Privy Wallet
export {
  createAgentWallet,
  getWallet,
  executeViaExecutor,
  executeDirectly,
} from "./privy"

// Prompt Builder
export { buildSystemPrompt, buildToolDescriptions } from "./prompt"
