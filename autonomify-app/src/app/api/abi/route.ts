import { NextRequest, NextResponse } from "next/server"
import type { Abi, AbiItem } from "viem"
import { type Chain } from "autonomify-sdk"
import { type ApiResponse } from "@/lib/agent"
import { fetchAbi, isValidAddress } from "@/lib/contracts"
import {
  resolveChainIdWithDefault,
  getChainOrThrow,
  DEFAULT_CHAIN_ID,
} from "@/lib/chains"

interface AbiResponseData {
  address: string
  chain: string
  abi: Abi
  source: string
  functionCount: number
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainParam = searchParams.get("chain")
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
    const { abi, source } = await fetchAbi(chainId, address)
    const functionCount = abi.filter((item: AbiItem) => item.type === "function").length

    return NextResponse.json<ApiResponse<AbiResponseData>>({
      ok: true,
      data: {
        address,
        chain: chain.name,
        abi,
        source,
        functionCount,
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
