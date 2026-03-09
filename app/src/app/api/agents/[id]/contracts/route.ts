import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import {
  getAgent,
  addContractToAgent,
  ChainMismatchError,
  type AgentContract,
  type ApiResponse,
} from "@/lib/agent"
import { syncPolicyToEnclave, type EnclavePolicyConfig } from "@/lib/agent/cre"
import { db } from "@/lib/db"
import { agentAllowedContracts, agentPolicies, agents, autonomifiedContracts } from "@/lib/db/schema"
import { isValidAddress } from "@/lib/contracts"
import {
  resolveChainIdWithDefault,
  getChainOrThrow,
  DEFAULT_CHAIN_ID,
} from "@/lib/chains"
import type { FunctionExport, Chain } from "autonomify-sdk"
import type { Abi } from "viem"

interface ContractAnalysis {
  name: string
  summary: string
  contractType: string
  capabilities: string[]
  functionDescriptions: Record<string, string>
}

interface AddContractBody {
  chain?: string
  chainId?: number
  address: string
  analysis?: ContractAnalysis
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

  // === VALIDATION: Contract must be autonomified first ===
  const normalizedAddress = address.toLowerCase()
  const [cachedContract] = await db
    .select()
    .from(autonomifiedContracts)
    .where(
      and(
        eq(autonomifiedContracts.address, normalizedAddress),
        eq(autonomifiedContracts.chainId, chainId)
      )
    )
    .limit(1)

  if (!cachedContract) {
    return NextResponse.json<ApiResponse>(
      {
        ok: false,
        error: `Contract ${address} has not been autonomified. Use the Autonomify frontend to analyze the contract first.`,
      },
      { status: 400 }
    )
  }

  try {
    // Use cached data from autonomified_contracts
    const abi = cachedContract.abi as Abi
    const metadata = cachedContract.metadata as Record<string, unknown>
    const functions = cachedContract.functions as FunctionExport[]
    const analysis = cachedContract.analysis as ContractAnalysis | undefined

    const contract: AgentContract = {
      address: normalizedAddress,
      chainId,
      chain,
      abi,
      metadata,
      functions,
      analysis,
    }

    const updated = await addContractToAgent(params.id, contract)

    if (!updated) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: "Failed to add contract" },
        { status: 500 }
      )
    }

    // === WHITELIST SYNC ===
    // 1. Add contract to agentAllowedContracts table
    await db
      .insert(agentAllowedContracts)
      .values({
        agentId: params.id,
        contractAddress: normalizedAddress,
      })
      .onConflictDoNothing()

    // 2. Get ALL allowed contracts for this agent
    const allAllowedContracts = await db
      .select()
      .from(agentAllowedContracts)
      .where(eq(agentAllowedContracts.agentId, params.id))

    const allowedAddresses = allAllowedContracts.map((c) => c.contractAddress)

    // 3. Rebuild merkle tree with verification service
    let whitelistRoot: string | null = null
    let whitelistPath: string[] = ["0", "0"]
    let whitelistIndex = 0

    try {
      const merkleRes = await fetch(
        `${process.env.VERIFICATION_SERVICE_URL || "http://localhost:3001"}/merkle`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            addresses: allowedAddresses,
            targetIndex: allowedAddresses.length - 1, // new contract is last
          }),
        }
      )
      const merkleData = await merkleRes.json()
      if (merkleData.root) {
        whitelistRoot = merkleData.root
        whitelistPath = merkleData.path
        whitelistIndex = merkleData.index
      }
    } catch (merkleErr) {
      console.error("Failed to generate merkle root:", merkleErr)
    }

    // 4. Update agent_policies.whitelist_root
    if (whitelistRoot) {
      await db
        .update(agentPolicies)
        .set({ whitelistRoot, syncStatus: "pending" })
        .where(eq(agentPolicies.agentId, params.id))
    }

    // 5. Sync updated policy to enclave
    const [agentRecord] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, params.id))
      .limit(1)

    if (agentRecord?.agentIdBytes && whitelistRoot) {
      // Get current policy settings
      const [policy] = await db
        .select()
        .from(agentPolicies)
        .where(eq(agentPolicies.agentId, params.id))
        .limit(1)

      if (policy) {
        try {
          const enclaveConfig: EnclavePolicyConfig = {
            maxAmount: {
              enabled: true,
              limit: parseInt(policy.txLimit || "0"),
            },
            timeWindow: {
              enabled: policy.enableTimeWindow === 1,
              startHour: policy.startHour || 0,
              endHour: policy.endHour || 24,
            },
            whitelist: {
              enabled: true,
              root: whitelistRoot,
              path: whitelistPath,
              index: whitelistIndex,
            },
          }

          const enclaveResult = await syncPolicyToEnclave(
            agentRecord.ownerAddress,
            agentRecord.agentIdBytes,
            enclaveConfig
          )

          if (enclaveResult.success) {
            await db
              .update(agentPolicies)
              .set({ syncStatus: "synced", lastSyncedAt: new Date() })
              .where(eq(agentPolicies.agentId, params.id))
            console.log(`[Contracts API] Policy synced to enclave for agent ${params.id}`)
          }
        } catch (enclaveErr) {
          console.error("Failed to sync policy to enclave:", enclaveErr)
        }
      }
    }

    return NextResponse.json<ApiResponse<ContractResponse>>({
      ok: true,
      data: {
        address: normalizedAddress,
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
