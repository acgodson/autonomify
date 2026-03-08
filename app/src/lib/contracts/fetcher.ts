/**
 * ABI Fetcher
 *
 * Fetches verified contract ABIs from multiple sources:
 * 1. Tenderly RPC (tenderly_getContractAbi) - preferred, no API key needed
 * 2. Block explorer APIs (Etherscan, Blockscout) - fallback
 *
 * Uses the chain's explorer configuration from the SDK.
 * API keys are resolved from environment variables per-chain.
 */

import type { Abi } from "viem"
import { getChainOrThrow, type Chain, type ExplorerType } from "@/lib/chains"
import { getExplorerApiKey } from "@/lib/chains"

// =============================================================================
// TYPES
// =============================================================================

interface ExplorerResponse {
  status: string
  message: string
  result: string
}

interface FetchAbiResult {
  abi: Abi
  source: string
}

// Tenderly ABI format (slightly different from standard)
interface TenderlyAbiItem {
  type: string
  name: string
  constant: boolean
  anonymous: boolean
  stateMutability: string
  inputs: TenderlyAbiInput[] | null
  outputs: TenderlyAbiOutput[] | null
}

interface TenderlyAbiInput {
  name: string
  type: string
  indexed?: boolean
}

interface TenderlyAbiOutput {
  name: string
  type: string
}

// =============================================================================
// ETHERSCAN-COMPATIBLE FETCHER
// =============================================================================

/**
 * Fetch ABI from Etherscan-compatible explorer (Etherscan, BscScan, etc.)
 */
async function fetchFromEtherscan(
  chain: Chain,
  address: string,
  apiKey: string
): Promise<FetchAbiResult> {
  const params = new URLSearchParams({
    module: "contract",
    action: "getabi",
    address: address,
    apikey: apiKey,
  })

  const url = `${chain.explorer.apiUrl}?${params.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Explorer API error: HTTP ${response.status}`)
  }

  const data: ExplorerResponse = await response.json()

  if (data.status !== "1") {
    if (data.result?.includes("not verified")) {
      throw new Error(
        `Contract not verified on ${chain.explorer.name}. ` +
        `Verify at ${chain.explorer.url}/address/${address}#code`
      )
    }
    if (data.result?.includes("Invalid API Key")) {
      throw new Error(
        `Invalid API key for ${chain.explorer.name}. ` +
        `Check your ${chain.explorer.apiKeyEnvVar} environment variable.`
      )
    }
    if (data.result?.includes("rate limit")) {
      throw new Error(
        `Rate limited by ${chain.explorer.name}. Please wait and try again.`
      )
    }
    throw new Error(data.result || `Failed to fetch ABI from ${chain.explorer.name}`)
  }

  let abi: Abi
  try {
    abi = JSON.parse(data.result)
  } catch {
    throw new Error("Invalid ABI format returned from explorer")
  }

  return { abi, source: chain.explorer.name }
}

// =============================================================================
// BLOCKSCOUT FETCHER
// =============================================================================

/**
 * Fetch ABI from Blockscout explorer
 */
async function fetchFromBlockscout(
  chain: Chain,
  address: string,
  _apiKey: string
): Promise<FetchAbiResult> {
  // Blockscout uses a different API format
  const url = `${chain.explorer.apiUrl}?module=contract&action=getabi&address=${address}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Blockscout API error: HTTP ${response.status}`)
  }

  const data: ExplorerResponse = await response.json()

  if (data.status !== "1") {
    throw new Error(data.result || `Failed to fetch ABI from Blockscout`)
  }

  let abi: Abi
  try {
    abi = JSON.parse(data.result)
  } catch {
    throw new Error("Invalid ABI format from Blockscout")
  }

  return { abi, source: "Blockscout" }
}

// =============================================================================
// TENDERLY RPC FETCHER
// =============================================================================

// Tenderly RPC URLs by chain ID
const TENDERLY_RPC_URLS: Record<number, string> = {
  84532: process.env.TENDERLY_BASE_SEPOLIA_RPC || "",
  // Add more chains as needed
}

/**
 * Convert Tenderly ABI format to standard ABI format
 */
function normalizeTenderlyAbi(tenderlyAbi: TenderlyAbiItem[]): Abi {
  return tenderlyAbi.map((item) => {
    if (item.type === "function") {
      return {
        type: "function" as const,
        name: item.name,
        inputs: (item.inputs || []).map((i) => ({ name: i.name, type: i.type })),
        outputs: (item.outputs || []).map((o) => ({ name: o.name, type: o.type })),
        stateMutability: (item.stateMutability || "nonpayable") as "pure" | "view" | "nonpayable" | "payable",
      }
    }
    if (item.type === "event") {
      return {
        type: "event" as const,
        name: item.name,
        inputs: (item.inputs || []).map((i) => ({
          name: i.name,
          type: i.type,
          indexed: i.indexed || false,
        })),
      }
    }
    if (item.type === "constructor") {
      return {
        type: "constructor" as const,
        inputs: (item.inputs || []).map((i) => ({ name: i.name, type: i.type })),
        stateMutability: (item.stateMutability || "nonpayable") as "nonpayable" | "payable",
      }
    }
    if (item.type === "fallback") {
      return { type: "fallback" as const }
    }
    if (item.type === "receive") {
      return { type: "receive" as const, stateMutability: "payable" as const }
    }
    // Skip unknown types
    return null
  }).filter(Boolean) as Abi
}

/**
 * Fetch ABI from Tenderly RPC using tenderly_getContractAbi method
 */
async function fetchFromTenderly(
  chainId: number,
  address: string
): Promise<FetchAbiResult | null> {
  const rpcUrl = TENDERLY_RPC_URLS[chainId]
  if (!rpcUrl) {
    return null // Tenderly not configured for this chain
  }

  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tenderly_getContractAbi",
        params: [address],
        id: 1,
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (data.error || !data.result) {
      return null
    }

    const abi = normalizeTenderlyAbi(data.result)
    return { abi, source: "Tenderly" }
  } catch {
    return null
  }
}

// =============================================================================
// MAIN FETCHER
// =============================================================================

const FETCHERS: Record<ExplorerType, typeof fetchFromEtherscan> = {
  etherscan: fetchFromEtherscan,
  blockscout: fetchFromBlockscout,
}

/**
 * Fetch ABI for a contract.
 * Tries Tenderly first (no API key needed), then falls back to block explorer.
 *
 * @param chainId - Chain ID
 * @param address - Contract address
 * @returns { abi, source } - The ABI and which source it came from
 *
 * @throws Error if chain unknown, API key missing, or contract not verified
 */
export async function fetchAbi(
  chainId: number,
  address: string
): Promise<FetchAbiResult> {
  const chain = getChainOrThrow(chainId)

  // Try Tenderly first (faster, no API key needed)
  const tenderlyResult = await fetchFromTenderly(chainId, address)
  if (tenderlyResult) {
    console.log(`[fetchAbi] Got ABI from Tenderly for ${address}`)
    return tenderlyResult
  }

  // Fall back to block explorer
  console.log(`[fetchAbi] Tenderly unavailable, falling back to ${chain.explorer.name}`)
  const apiKey = getExplorerApiKey(chainId)

  const fetcher = FETCHERS[chain.explorer.type]
  if (!fetcher) {
    throw new Error(`Unsupported explorer type: ${chain.explorer.type}`)
  }

  return fetcher(chain, address, apiKey)
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Validate an Ethereum address format.
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Normalize an address to checksummed format.
 */
export function normalizeAddress(address: string): `0x${string}` {
  if (!isValidAddress(address)) {
    throw new Error(`Invalid address: ${address}`)
  }
  return address.toLowerCase() as `0x${string}`
}
