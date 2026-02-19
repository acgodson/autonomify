import { NextRequest, NextResponse } from "next/server"
import {
  fetchAbi,
  isValidAddress,
  resolveMetadata,
  extractFunctions,
  getChain,
  type ApiResponse,
  type FunctionInfo,
  type ChainConfig,
} from "@/lib/autonomify-core"
import type { Abi } from "viem"

interface ResolveResponseData {
  address: string
  chain: string
  metadata: Record<string, unknown>
  functions: FunctionInfo[]
}

interface FullResolveResponseData {
  address: string
  chain: ChainConfig
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionInfo[]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainId = searchParams.get("chain") || "bscTestnet"
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

  const chain = getChain(chainId)
  if (!chain) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: `Unknown chain: ${chainId}` },
      { status: 400 }
    )
  }

  try {
    const { abi } = await fetchAbi(chain, address)
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
        chain: chainId,
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
