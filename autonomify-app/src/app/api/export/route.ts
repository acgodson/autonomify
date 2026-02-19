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
  fetchAbi,
  isValidAddress,
  resolveMetadata,
  extractFunctions,
  getChain,
  generateExport,
  type ApiResponse,
  type AutonomifyExport,
  type ContractContext,
} from "@/lib/autonomify-core"

interface ExportRequest {
  chain: string
  addresses: string[]
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const chainId = searchParams.get("chain") || "bscTestnet"
  const addressesParam = searchParams.get("addresses")

  if (!addressesParam) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing addresses parameter" },
      { status: 400 }
    )
  }

  const addresses = addressesParam.split(",").map((a) => a.trim())

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

  const { chain: chainId = "bscTestnet", addresses } = body

  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing or empty addresses array" },
      { status: 400 }
    )
  }

  return generateExportResponse(chainId, addresses)
}

async function generateExportResponse(chainId: string, addresses: string[]) {
  const chain = getChain(chainId)
  if (!chain) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: `Unknown chain: ${chainId}` },
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
    const contracts: ContractContext[] = []

    for (const address of addresses) {
      const { abi } = await fetchAbi(chain, address)
      const metadata = await resolveMetadata(chain, address, abi)
      const functions = extractFunctions(abi)

      contracts.push({
        address,
        chain,
        abi,
        metadata,
        functions,
      })
    }

    // Generate the export
    const exportData = generateExport(chain, contracts)

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
