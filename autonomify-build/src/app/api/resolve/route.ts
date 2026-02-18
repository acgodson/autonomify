import { NextRequest, NextResponse } from "next/server"
import { fetchAbi, isValidAddress } from "@/lib/abi-fetcher"
import { resolveMetadata, extractFunctions } from "@/lib/metadata-resolver"
import { getChain } from "@/lib/chains"
import type { ApiResponse, FunctionInfo } from "@/lib/types"

interface ResolveResponseData {
  address: string
  chain: string
  metadata: Record<string, unknown>
  functions: FunctionInfo[]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainId = searchParams.get("chain") || "bscTestnet"
  const address = searchParams.get("address")

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
