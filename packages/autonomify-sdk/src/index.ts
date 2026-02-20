/**
 * Autonomify SDK
 *
 * Universal SDK for building AI agents that interact with smart contracts.
 * Works with any wallet adapter - you provide the signing logic.
 *
 * @example
 * ```typescript
 * // Vercel AI SDK
 * import { createAutonomifyTool, buildSystemPrompt } from 'autonomify-sdk'
 * import { generateText } from 'ai'
 * import { openai } from '@ai-sdk/openai'
 *
 * const tool = createAutonomifyTool({
 *   export: config,
 *   agentId: '0x...',
 *   signAndSend: async (tx) => wallet.sendTransaction(tx)
 * })
 *
 * const { text } = await generateText({
 *   model: openai('gpt-4'),
 *   tools: { autonomify_execute: tool },
 *   system: buildSystemPrompt(config),
 *   prompt: 'Transfer 100 USDT to 0xABC'
 * })
 * ```
 *
 * @example
 * ```typescript
 * // OpenAI SDK
 * import { createOpenAITool, buildSystemPrompt } from 'autonomify-sdk'
 * import OpenAI from 'openai'
 *
 * const { tools, handler } = createOpenAITool({
 *   export: config,
 *   agentId: '0x...',
 *   signAndSend: async (tx) => wallet.sendTransaction(tx)
 * })
 *
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Transfer 100 USDT' }],
 *   tools,
 * })
 * ```
 */

// Types
export type {
  AutonomifyExport,
  ContractExport,
  FunctionExport,
  FunctionParam,
  ChainConfig,
  ExecuteParams,
  UnsignedTransaction,
  ExecuteResult,
  SignAndSendFn,
  AutonomifyToolConfig,
} from "./types"

// Encoder (for custom integrations)
export {
  encodeContractCall,
  encodeExecutorCall,
  buildTransaction,
} from "./encoder"

// Vercel AI SDK integration
export {
  createAutonomifyTool,
  buildSystemPrompt,
} from "./vercel-ai"

// OpenAI SDK integration
export {
  createOpenAITool,
  type OpenAITool,
  type OpenAIToolCall,
  type OpenAIToolResult,
} from "./openai"
