/**
 * ABI Fetcher
 *
 * Fetches verified contract ABIs from block explorer APIs.
 */

import type { Abi } from "viem"
import type { ChainConfig } from "./types"

const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api"

interface EtherscanResponse {
  status: string
  message: string
  result: string
}

export async function fetchAbi(
  chain: ChainConfig,
  address: string
): Promise<{ abi: Abi; source: string }> {
  const apiKey = chain.explorerApiKey || process.env.BSCSCAN_API_KEY

  if (!apiKey) {
    throw new Error("Explorer API key is required for fetching ABIs")
  }

  const params = new URLSearchParams({
    chainid: chain.id.toString(),
    module: "contract",
    action: "getabi",
    address: address,
    apikey: apiKey,
  })

  const url = `${ETHERSCAN_V2_API}?${params.toString()}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ABI: HTTP ${response.status}`)
  }

  const data: EtherscanResponse = await response.json()

  if (data.status !== "1") {
    if (data.result.includes("not verified")) {
      throw new Error("Contract source code not verified")
    }
    if (data.result.includes("Invalid API Key")) {
      throw new Error("Invalid or missing API key")
    }
    throw new Error(data.result || "Failed to fetch ABI from explorer")
  }

  let abi: Abi
  try {
    abi = JSON.parse(data.result)
  } catch {
    throw new Error("Invalid ABI format returned from explorer")
  }

  return { abi, source: "etherscan-v2" }
}

export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}
