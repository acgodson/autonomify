/**
 * Autonomify Core
 *
 * Platform-agnostic contract resolution and universal tool SDK.
 * Use this to build your own agent implementations.
 *
 * @example
 * ```typescript
 * import {
 *   resolveContract,
 *   generateExport,
 *   createAutonomifyTool,
 *   buildSystemPrompt
 * } from "@/lib/autonomify-core"
 *
 * // 1. Resolve contracts
 * const contract = await resolveContract({ chainId: "bscTestnet", address: "0x..." })
 *
 * // 2. Generate export
 * const exportData = generateExport(chain, [contract])
 *
 * // 3. Create universal tool (with your wallet)
 * const autonomify = createAutonomifyTool({
 *   export: exportData,
 *   agentId: "0x...",
 *   signAndSend: async (tx) => await yourWallet.sendTransaction(tx)
 * })
 *
 * // 4. Use with any LLM
 * const { text } = await generateText({
 *   model: openai("gpt-4"),
 *   tools: { autonomify },
 *   system: buildSystemPrompt(exportData),
 *   prompt: "Send 100 USDT to 0xABC"
 * })
 * ```
 */

// Core Types
export type {
  ChainConfig,
  FunctionInfo,
  ContractContext,
  ContractAnalysis,
  ResolvedContract,
  ApiResponse,
} from "./types"

// Chain utilities
export { chains, getChain, getChainById, bscTestnet, bscMainnet } from "./chains"

// Contract resolution
export {
  resolveContract,
  resolveMetadata,
  extractFunctions,
  isValidAddress,
} from "./contract-resolver"

// ABI fetching
export { fetchAbi } from "./abi-fetcher"

// SDK - Universal Tool Pattern (imported from autonomify-sdk package)
export {
  // Types
  type AutonomifyExport,
  type ContractExport,
  type FunctionExport,
  type FunctionParam,
  type ChainConfig as SDKChainConfig,
  type ExecuteParams,
  type UnsignedTransaction,
  type ExecuteResult,
  type SignAndSendFn,
  type AutonomifyToolConfig,
  // Encoder
  encodeContractCall,
  encodeExecutorCall,
  buildTransaction,
  // Vercel AI SDK
  createAutonomifyTool,
  buildSystemPrompt,
  // OpenAI SDK
  createOpenAITool,
  type OpenAITool,
  type OpenAIToolCall,
  type OpenAIToolResult,
} from "autonomify-sdk"

// Export generator (internal - converts from ContractContext to SDK format)
export {
  generateExport,
  getExecutorAddress,
  getExecutorAbi,
} from "./export-generator"
