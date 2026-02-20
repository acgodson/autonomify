/**
 * Export API
 *
 * Generates AutonomifyExport JSON for resolved contracts.
 * This is the new universal format that works with createAutonomifyTool.
 *
 * GET /api/export?chain=bscTestnet&addresses=0x...,0x...
 * POST /api/export { chain: "bscTestnet", contracts: [...] }
 */

import { NextRequest, NextResponse } from "next/server"
import {
  getExecutorAddress,
  EXECUTOR_ABI,
  type AutonomifyExport,
  type Chain,
} from "autonomify-sdk"
import { type ApiResponse, type AgentContract } from "@/lib/agent"
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

interface ExportRequest {
  chain?: string
  chainId?: number
  addresses: string[]
}

// Build AutonomifyExport from resolved contracts
function buildExport(chain: Chain, contracts: AgentContract[]): AutonomifyExport {
  const executorAddress = getExecutorAddress(chain.id)

  const contractsMap: AutonomifyExport["contracts"] = {}
  for (const contract of contracts) {
    contractsMap[contract.address.toLowerCase() as `0x${string}`] = {
      name: (contract.metadata.name as string) || contract.address.slice(0, 10),
      abi: contract.abi,
      metadata: contract.metadata,
      functions: contract.functions,
    }
  }

  return {
    version: "1.0.0",
    executor: {
      address: executorAddress || ("0x0000000000000000000000000000000000000000" as `0x${string}`),
      abi: EXECUTOR_ABI,
    },
    chain: {
      id: chain.id,
      name: chain.name,
      rpc: chain.rpc[0],
    },
    contracts: contractsMap,
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainParam = searchParams.get("chain")
  const addressesParam = searchParams.get("addresses")

  if (!addressesParam) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing addresses parameter" },
      { status: 400 }
    )
  }

  const addresses = addressesParam.split(",").map((a) => a.trim())
  const chainId = resolveChainIdWithDefault(chainParam, DEFAULT_CHAIN_ID)

  return generateExportResponse(chainId, addresses)
}

export async function POST(request: NextRequest) {
  let body: ExportRequest

  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const { addresses } = body

  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing or empty addresses array" },
      { status: 400 }
    )
  }

  const chainId = body.chainId || resolveChainIdWithDefault(body.chain, DEFAULT_CHAIN_ID)

  return generateExportResponse(chainId, addresses)
}

async function generateExportResponse(chainId: number, addresses: string[]) {
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

  // Validate all addresses
  for (const address of addresses) {
    if (!isValidAddress(address)) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: `Invalid address: ${address}` },
        { status: 400 }
      )
    }
  }

  try {
    // Resolve all contracts
    const contracts: AgentContract[] = []

    for (const address of addresses) {
      const { abi } = await fetchAbi(chainId, address)
      const metadata = await resolveMetadata(chain, address, abi)
      const functions = extractFunctions(abi)

      contracts.push({
        address,
        chainId,
        chain,
        abi,
        metadata,
        functions,
      })
    }

    // Generate the export
    const exportData = buildExport(chain, contracts)

    return NextResponse.json<ApiResponse<AutonomifyExport>>({
      ok: true,
      data: exportData,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
