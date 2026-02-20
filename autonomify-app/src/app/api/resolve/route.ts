import { NextRequest, NextResponse } from "next/server"
import type { Abi } from "viem"
import { type Chain, type FunctionExport } from "autonomify-sdk"
import { type ApiResponse } from "@/lib/agent"
import {
  fetchAbi,
  isValidAddress,
  resolveMetadata,
  extractFunctions,
} from "@/lib/contracts"
import {
  resolveChainIdWithDefault,
  getChainOrThrow,
  DEFAULT_CHAIN_ID,
} from "@/lib/chains"

interface ResolveResponseData {
  address: string
  chain: string
  chainId: number
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainParam = searchParams.get("chain") || searchParams.get("chainId")
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

  // Use the centralized chain resolution
  const chainId = resolveChainIdWithDefault(chainParam, DEFAULT_CHAIN_ID)

  let chain: Chain
  try {
    chain = getChainOrThrow(chainId)
  } catch (err) {
    const message = err instanceof Error ? err.message : `Unknown chain ID: ${chainId}`
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
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

    // Standard response
    return NextResponse.json<ApiResponse<ResolveResponseData>>({
      ok: true,
      data: {
        address,
        chain: chain.name,
        chainId: chain.id,
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
