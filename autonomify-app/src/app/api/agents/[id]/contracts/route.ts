import { NextRequest, NextResponse } from "next/server"
import { getChain } from "autonomify-sdk"
import {
  getAgent,
  addContractToAgent,
  type AgentContract,
  type ApiResponse,
} from "@/lib/agent"
import {
  fetchAbi,
  isValidAddress,
  resolveMetadata,
  extractFunctions,
} from "@/lib/contracts"

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

// Map legacy chain names to chain IDs
function resolveChainId(chainParam?: string | number): number {
  if (typeof chainParam === "number") return chainParam
  if (!chainParam) return 97 // Default to BSC Testnet

  // Try parsing as number first
  const parsed = parseInt(chainParam, 10)
  if (!isNaN(parsed)) return parsed

  // Legacy name mapping
  const legacyNames: Record<string, number> = {
    bscTestnet: 97,
    bscMainnet: 56,
    bsc: 56,
    ethereum: 1,
    sepolia: 11155111,
    polygon: 137,
    arbitrum: 42161,
    base: 8453,
  }

  return legacyNames[chainParam] || 97
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

  const chainId = body.chainId || resolveChainId(body.chain)
  const chain = getChain(chainId)

  if (!chain) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: `Unknown chain ID: ${chainId}` },
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
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
