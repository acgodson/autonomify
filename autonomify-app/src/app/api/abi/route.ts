import { NextRequest, NextResponse } from "next/server"
import {
  fetchAbi,
  isValidAddress,
  getChain,
  type ApiResponse,
} from "@/lib/autonomify-core"
import type { Abi, AbiItem } from "viem"

interface AbiResponseData {
  address: string
  chain: string
  abi: Abi
  source: string
  functionCount: number
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
    const { abi, source } = await fetchAbi(chain, address)
    const functionCount = abi.filter((item: AbiItem) => item.type === "function").length

    return NextResponse.json<ApiResponse<AbiResponseData>>({
      ok: true,
      data: {
        address,
        chain: chainId,
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
