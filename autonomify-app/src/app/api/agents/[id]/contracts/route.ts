import { NextRequest, NextResponse } from "next/server"
import {
  getAgent,
  addContractToAgent,
  ChainMismatchError,
  type AgentContract,
  type ApiResponse,
} from "@/lib/agent"
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

interface AddContractBody {
  chain?: string // Chain ID as string (e.g., "97" or "56") or legacy name (e.g., "bscTestnet")
  chainId?: number // Chain ID as number
  address: string
}

interface ContractResponse {
  address: string
  chain: string
  chainId: number
  metadata: Record<string, unknown>
  functionCount: number
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const agent = await getAgent(params.id)

  if (!agent) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Agent not found" },
      { status: 404 }
    )
  }

  const contracts: ContractResponse[] = agent.contracts.map((c) => ({
    address: c.address,
    chain: c.chain.name,
    chainId: c.chainId,
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
  const agent = await getAgent(params.id)

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

  const address = body.address

  if (!address || !isValidAddress(address)) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid or missing address" },
      { status: 400 }
    )
  }

  // Use centralized chain resolution
  const chainId = resolveChainIdWithDefault(body.chainId || body.chain, DEFAULT_CHAIN_ID)

  let chain
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

    const contract: AgentContract = {
      address,
      chainId,
      chain,
      abi,
      metadata,
      functions,
    }

    const updated = await addContractToAgent(params.id, contract)

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
        chainId,
        metadata,
        functionCount: functions.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"

    // Chain mismatch is a client error (400), not a server error (500)
    if (error instanceof ChainMismatchError) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: message },
        { status: 400 }
      )
    }

    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
