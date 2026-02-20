import { NextRequest, NextResponse } from "next/server"
import type { Abi } from "viem"
import { getChain, type Chain, type FunctionExport } from "autonomify-sdk"
import { type ApiResponse } from "@/lib/agent"
import {
  fetchAbi,
  isValidAddress,
  resolveMetadata,
  extractFunctions,
} from "@/lib/contracts"

interface ResolveResponseData {
  address: string
  chain: string
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

interface FullResolveResponseData {
  address: string
  chain: Chain
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

// Map legacy chain names to chain IDs
function resolveChainId(chainParam?: string | null): number {
  if (!chainParam) return 97 // Default to BSC Testnet

  // Try parsing as number first
  const parsed = parseInt(chainParam, 10)
  if (!isNaN(parsed)) return parsed

  // Legacy name mapping
  const legacyNames: Record<string, number> = {
    bscTestnet: 97,
    bscMainnet: 56,
    bsc: 56,
    ethereum: 1,
    sepolia: 11155111,
    polygon: 137,
    arbitrum: 42161,
    base: 8453,
  }

  return legacyNames[chainParam] || 97
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainParam = searchParams.get("chain")
  const address = searchParams.get("address")
  const full = searchParams.get("full") === "true"

  if (!address) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing address parameter" },
      { status: 400 }
    )
  }

  if (!isValidAddress(address)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid address format" },
      { status: 400 }
    )
  }

  const chainId = resolveChainId(chainParam)
  const chain = getChain(chainId)
  if (!chain) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: `Unknown chain ID: ${chainId}` },
      { status: 400 }
    )
  }

  try {
    const { abi } = await fetchAbi(chainId, address)
    const metadata = await resolveMetadata(chain, address, abi)
    const functions = extractFunctions(abi)

    // Full response includes ABI and chain config - used for SDK export
    if (full) {
      return NextResponse.json<ApiResponse<FullResolveResponseData>>({
        ok: true,
        data: {
          address,
          chain,
          abi,
          metadata,
          functions,
        },
      })
    }

    // Standard response for backwards compatibility
    return NextResponse.json<ApiResponse<ResolveResponseData>>({
      ok: true,
      data: {
        address,
        chain: chain.name,
        metadata,
        functions,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
