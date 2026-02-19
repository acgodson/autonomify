/**
 * Autonomify Core Types
 *
 * These are platform-agnostic types for the Autonomify contract resolution
 * and tool export system. Agent implementations should import from here.
 */

import type { Abi, AbiFunction, AbiParameter } from "viem"

export interface ChainConfig {
  id: number
  name: string
  rpc: string
  explorer: string
  explorerApi: string
  explorerApiKey?: string
}

export interface FunctionInfo {
  name: string
  signature: string
  abi: AbiFunction
  stateMutability: "pure" | "view" | "nonpayable" | "payable"
  inputs: readonly AbiParameter[]
  outputs: readonly AbiParameter[]
}

export interface ContractContext {
  address: string
  chain: ChainConfig
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionInfo[]
}

export interface ContractAnalysis {
  summary: string
  contractType: string
  capabilities: string[]
  functionDescriptions: Record<string, string>
}

export interface ResolvedContract {
  address: string
  chain: ChainConfig
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionInfo[]
  analysis?: ContractAnalysis
}

// Tool Export Types
export interface ToolParameter {
  type: string
  description: string
  enum?: string[]
  items?: { type: string }
}

export interface JsonSchemaTool {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, ToolParameter>
    required: string[]
  }
}

export interface TypeScriptTool {
  name: string
  signature: string
  description: string
  params: Array<{
    name: string
    type: string
    description: string
  }>
  returns: string
}

export interface OpenAITool {
  type: "function"
  function: {
    name: string
    description: string
    parameters: {
      type: "object"
      properties: Record<string, ToolParameter>
      required: string[]
    }
  }
}

export type ExportFormat = "json-schema" | "typescript" | "openai" | "sdk"

export interface ExportResult {
  contractAddress: string
  chain: string
  format: ExportFormat
  tools: JsonSchemaTool[] | TypeScriptTool[] | OpenAITool[]
}

// SDK Export - Full package for agent developers
export interface SDKExport {
  contractAddress: string
  chain: {
    id: number
    name: string
    rpc: string
  }
  abi: unknown[]
  metadata: Record<string, unknown>
  tools: OpenAITool[]
  code: {
    typescript: string
    javascript: string
  }
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
