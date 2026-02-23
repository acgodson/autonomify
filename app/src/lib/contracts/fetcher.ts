/**
 * ABI Fetcher
 *
 * Fetches verified contract ABIs from block explorer APIs.
 * Supports multiple explorer types (Etherscan, Blockscout).
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
// MAIN FETCHER
// =============================================================================

const FETCHERS: Record<ExplorerType, typeof fetchFromEtherscan> = {
  etherscan: fetchFromEtherscan,
  blockscout: fetchFromBlockscout,
}

/**
 * Fetch ABI for a contract.
 * Automatically uses the correct explorer for the chain.
 *
 * @param chainId - Chain ID
 * @param address - Contract address
 * @returns { abi, source } - The ABI and which explorer it came from
 *
 * @throws Error if chain unknown, API key missing, or contract not verified
 */
export async function fetchAbi(
  chainId: number,
  address: string
): Promise<FetchAbiResult> {
  const chain = getChainOrThrow(chainId)
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
