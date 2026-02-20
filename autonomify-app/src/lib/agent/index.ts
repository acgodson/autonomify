/**
 * Agent Module
 *
 * Core agent functionality - channel-agnostic business logic.
 * This module provides:
 * - Agent CRUD operations (store)
 * - Wallet management (wallet)
 * - LLM-powered execution (runner)
 * - Conversation history (conversation)
 *
 */


export type {
  Agent,
  AgentWallet,
  AgentContract,
  ChannelType,
  AgentType,
  ExecuteParams,
  SimulateResult,
  ExecuteResult,
  ApiResponse,
  Chain,
  FunctionExport,
} from "./types"

// Agent Store (CRUD)
export {
  createAgent,
  getAgent,
  listAgents,
  updateAgent,
  deleteAgent,
  addContractToAgent,
  removeContractFromAgent,
  ChainMismatchError,
  type CreateAgentOptions,
} from "./store"

export {
  buildAgentExport,
  buildAgentPrompt,
  createAgentTool,
  validateAgentCall,
  simulate,
  execute,
  getNativeBalance,
} from "./runner"


export {
  createAgentWallet,
  getWallet,
  executeViaExecutor,
  executeDirectly,
} from "./wallet"


export {
  getConversationHistory,
  addUserMessage,
  addAssistantMessage,
  addToolMessage,
  clearConversation,
  pruneOldMessages,
  findMessageByChannelId,
  markMessageError,
  deleteMessageByChannelId,
  softDeleteMessage,
  type MessageStatus,
  type AddMessageOptions,
} from "./conversation"

// Utilities
export {
  findContract,
  findAbiFunction,
  getAgentChainId,
  hasContracts,
  isAgentReady,
} from "./utils"
