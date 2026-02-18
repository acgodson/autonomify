import { NextRequest, NextResponse } from "next/server"
import { getAgent, addContractToAgent } from "@/lib/agent-store"
import { fetchAbi, isValidAddress } from "@/lib/abi-fetcher"
import { resolveMetadata, extractFunctions } from "@/lib/metadata-resolver"
import { getChain } from "@/lib/chains"
import type { ApiResponse, ContractContext } from "@/lib/types"

interface AddContractBody {
  chain: string
  address: string
}

interface ContractResponse {
  address: string
  chain: string
  metadata: Record<string, unknown>
  functionCount: number
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = getAgent(params.id)

  if (!agent) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  const contracts: ContractResponse[] = agent.contracts.map((c) => ({
    address: c.address,
    chain: c.chain.name,
    metadata: c.metadata,
    functionCount: c.functions.length,
  }))

  return NextResponse.json<ApiResponse<ContractResponse[]>>({
    ok: true,
    data: contracts,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = getAgent(params.id)

  if (!agent) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  let body: AddContractBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  const chainId = body.chain || "bscTestnet"
  const address = body.address

  if (!address || !isValidAddress(address)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid or missing address" },
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

    const contract: ContractContext = {
      address,
      chain,
      abi,
      metadata,
      functions,
    }

    const updated = addContractToAgent(params.id, contract)

    if (!updated) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: "Failed to add contract" },
        { status: 500 }
      )
    }

    return NextResponse.json<ApiResponse<ContractResponse>>({
      ok: true,
      data: {
        address,
        chain: chain.name,
        metadata,
        functionCount: functions.length,
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
