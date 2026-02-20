export type {
  ChainConfig,
  FunctionParam,
  FunctionExport,
  ContractExport,
  AutonomifyExport,
  ExecuteParams,
  UnsignedTransaction,
  ExecuteResult,
  SignAndSendFn,
  ToolConfig,
  StructuredCall,
} from "./types"

export {
  encodeContractCall,
  encodeExecutorCall,
  buildTransaction,
} from "./core/encoder"

export {
  EXECUTOR_ADDRESSES,
  EXECUTOR_ABI,
  getExecutorAddress,
  isExecutorDeployed,
  getDeployedChainIds,
  toBytes32,
} from "./core/executor"

export {
  findFunction,
  isReadOnly,
  serializeBigInts,
  argsToArray,
} from "./core/utils"

export {
  validateCall,
  type ValidationResult,
  type ValidationError,
} from "./core/validate"

export {
  createTool,
  buildPrompt,
  getPrompt,
  executeSchema,
  executeCall,
  type Tool,
  type ExecuteSchema,
} from "./tool"

export {
  createVercelTool,
  forVercelAI,
  buildSystemPrompt,
} from "./adapters/vercel-ai"

export {
  createOpenAITool,
  forOpenAI,
  type OpenAIToolDef,
  type OpenAIToolCall,
} from "./adapters/openai"

export {
  // Chain registry
  CHAINS,
  chains,
  // Chain access
  getChain,
  getChainOrThrow,
  getChains,
  getMainnets,
  getTestnets,
  getChainIds,
  isChainSupported,
  isTestnet,
  // Explorer utilities
  getExplorerUrl,
  getAddressUrl,
  getTokenUrl,
  // RPC utilities
  getRpcUrl,
  getRpcUrls,
  // Chain summaries (for API)
  getChainSummary,
  getChainSummaries,
  // Types
  type Chain,
  type ChainSummary,
  type NetworkMode,
  type ExplorerType,
} from "./chains"

export {
  detectType,
  detectPattern,
  getPattern,
  hasAdmin,
  type ContractType,
  type ContractPattern,
} from "./knowledge/patterns"
