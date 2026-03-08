import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { agentPolicies, agentAllowedContracts, agents } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { syncPolicyToEnclave, type EnclavePolicyConfig } from "@/lib/agent/cre"
import { formatUnits, parseUnits } from "viem"

interface PolicyResponse {
  maxTxAmount: string
  enableTimeWindow: boolean
  startHour: number
  endHour: number
  whitelistedContracts: { address: string; name: string | null }[]
  syncStatus: string
  lastSyncedAt: number | null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const [policy] = await db
      .select()
      .from(agentPolicies)
      .where(eq(agentPolicies.agentId, id))
      .limit(1)

    if (!policy) {
      return NextResponse.json({
        ok: true,
        data: null,
      })
    }

    const contracts = await db
      .select()
      .from(agentAllowedContracts)
      .where(eq(agentAllowedContracts.agentId, id))

    const response: PolicyResponse = {
      maxTxAmount: formatUnits(BigInt(policy.txLimit), 18),
      enableTimeWindow: policy.enableTimeWindow === 1,
      startHour: policy.startHour,
      endHour: policy.endHour,
      whitelistedContracts: contracts.map((c) => ({
        address: c.contractAddress,
        name: c.contractName,
      })),
      syncStatus: policy.syncStatus,
      lastSyncedAt: policy.lastSyncedAt?.getTime() ?? null,
    }

    return NextResponse.json({ ok: true, data: response })
  } catch (error) {
    console.error("[GET /api/agents/[id]/policy] Error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to fetch policy" },
      { status: 500 }
    )
  }
}

interface UpdatePolicyBody {
  maxTxAmount?: string
  enableTimeWindow?: boolean
  startHour?: number
  endHour?: number
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const body: UpdatePolicyBody = await request.json()

    // Get current policy
    const [currentPolicy] = await db
      .select()
      .from(agentPolicies)
      .where(eq(agentPolicies.agentId, id))
      .limit(1)

    if (!currentPolicy) {
      return NextResponse.json(
        { ok: false, error: "Policy not found" },
        { status: 404 }
      )
    }

    // Get agent info for enclave sync
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, id))
      .limit(1)

    if (!agent) {
      return NextResponse.json(
        { ok: false, error: "Agent not found" },
        { status: 404 }
      )
    }

    // Build update object
    const updates: Partial<typeof agentPolicies.$inferInsert> = {
      syncStatus: "pending",
    }

    if (body.maxTxAmount !== undefined) {
      updates.txLimit = parseUnits(body.maxTxAmount, 18).toString()
    }

    if (body.enableTimeWindow !== undefined) {
      updates.enableTimeWindow = body.enableTimeWindow ? 1 : 0
    }

    if (body.startHour !== undefined) {
      updates.startHour = body.startHour
    }

    if (body.endHour !== undefined) {
      updates.endHour = body.endHour
    }

    // Update policy in database
    await db
      .update(agentPolicies)
      .set(updates)
      .where(eq(agentPolicies.agentId, id))

    // Get updated policy
    const [updatedPolicy] = await db
      .select()
      .from(agentPolicies)
      .where(eq(agentPolicies.agentId, id))
      .limit(1)

    // Get allowed contracts for whitelist
    const contracts = await db
      .select()
      .from(agentAllowedContracts)
      .where(eq(agentAllowedContracts.agentId, id))

    // Sync to enclave
    const enclaveConfig: EnclavePolicyConfig = {
      maxAmount: {
        enabled: true,
        limit: Number(formatUnits(BigInt(updatedPolicy.txLimit), 18)),
      },
      timeWindow: {
        enabled: updatedPolicy.enableTimeWindow === 1,
        startHour: updatedPolicy.startHour,
        endHour: updatedPolicy.endHour,
      },
      whitelist: {
        enabled: contracts.length > 0,
        root: updatedPolicy.whitelistRoot ?? undefined,
      },
    }

    try {
      await syncPolicyToEnclave(agent.ownerAddress, id, enclaveConfig)

      await db
        .update(agentPolicies)
        .set({
          syncStatus: "synced",
          lastSyncedAt: new Date(),
          policyVersion: updatedPolicy.policyVersion + 1,
        })
        .where(eq(agentPolicies.agentId, id))
    } catch (syncError) {
      console.error("[PUT /api/agents/[id]/policy] Enclave sync failed:", syncError)
      await db
        .update(agentPolicies)
        .set({ syncStatus: "failed" })
        .where(eq(agentPolicies.agentId, id))
    }

    // Return updated policy
    const [finalPolicy] = await db
      .select()
      .from(agentPolicies)
      .where(eq(agentPolicies.agentId, id))
      .limit(1)

    const response: PolicyResponse = {
      maxTxAmount: formatUnits(BigInt(finalPolicy.txLimit), 18),
      enableTimeWindow: finalPolicy.enableTimeWindow === 1,
      startHour: finalPolicy.startHour,
      endHour: finalPolicy.endHour,
      whitelistedContracts: contracts.map((c) => ({
        address: c.contractAddress,
        name: c.contractName,
      })),
      syncStatus: finalPolicy.syncStatus,
      lastSyncedAt: finalPolicy.lastSyncedAt?.getTime() ?? null,
    }

    return NextResponse.json({ ok: true, data: response })
  } catch (error) {
    console.error("[PUT /api/agents/[id]/policy] Error:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to update policy" },
      { status: 500 }
    )
  }
}
