/**
 * Chains API
 *
 * Returns available chains based on network mode.
 * This is the single source of truth for the frontend.
 *
 * GET /api/chains
 * GET /api/chains?mode=testnet
 * GET /api/chains?mode=mainnet
 */

import { NextRequest, NextResponse } from "next/server"
import {
  type NetworkMode,
  getChainSummaries,
  getChainsWithAvailability,
  isExecutorDeployed,
} from "@/lib/chains"

interface ChainResponse {
  id: number
  name: string
  shortName: string
  testnet: boolean
  nativeSymbol: string
  explorerUrl: string
  ready: boolean
  executorDeployed: boolean
}

interface ChainsResponse {
  ok: boolean
  data: {
    mode: NetworkMode
    chains: ChainResponse[]
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const modeParam = searchParams.get("mode")

  let mode: NetworkMode = "all"
  if (modeParam === "testnet" || modeParam === "mainnet" || modeParam === "all") {
    mode = modeParam
  }

  const chainsWithAvailability = getChainsWithAvailability(mode)

  const chains: ChainResponse[] = chainsWithAvailability.map((c) => ({
    id: c.chain.id,
    name: c.chain.name,
    shortName: c.chain.shortName,
    testnet: c.chain.testnet,
    nativeSymbol: c.chain.nativeCurrency.symbol,
    explorerUrl: c.chain.explorer.url,
    ready: c.fullyReady,
    executorDeployed: c.executorDeployed,
  }))

  chains.sort((a, b) => {
    if (a.ready && !b.ready) return -1
    if (!a.ready && b.ready) return 1
    return a.name.localeCompare(b.name)
  })

  return NextResponse.json<ChainsResponse>({
    ok: true,
    data: {
      mode,
      chains,
    },
  })
}
